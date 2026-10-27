import { dbClient, DatabaseClient, type QueryResultRow } from '../db/client.ts';
import { redisClient, type IRedisClient } from '../redis/redis-client.ts';
import { paymentGatewayClient, type PaymentGatewayClient } from './payment.service.ts';
import { HttpError } from './otp.service.ts';

export const PLATFORM_COMMISSION_PERCENT = 0.15; // 15%
export const DISPATCH_EXPIRY_SECONDS = 45; // 45 seconds countdown

export interface CreateInstantMatchOptions {
  ownerId: string;
  workerId: string;
  petId: string;
  serviceType: 'WALK' | 'PLAYTIME' | 'BOARDING';
  durationMinutes: number;
  grossAmount: number;
  pickupLongitude: number;
  pickupLatitude: number;
  idempotencyKey: string;
  paymentToken?: string;
}

export interface BookingEntity {
  id: string;
  ownerId: string;
  workerId: string;
  petId: string;
  serviceType: string;
  durationMinutes: number;
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  grossAmount: number;
  commissionAmount: number;
  workerPayout: number;
  gatewayRef: string;
  idempotencyKey: string;
}

export interface WorkerDispatchNotification {
  bookingId: string;
  workerId: string;
  durationMinutes: number;
  workerPayout: number;
  sound: string;
  expiresInSeconds: number;
}

export class BookingDispatchService {
  private db: DatabaseClient;
  private redis: IRedisClient;
  private payment: PaymentGatewayClient;
  public lastDispatchNotification: WorkerDispatchNotification | null = null;

  constructor(
    db: DatabaseClient = dbClient,
    redis: IRedisClient = redisClient,
    payment: PaymentGatewayClient = paymentGatewayClient
  ) {
    this.db = db;
    this.redis = redis;
    this.payment = payment;
  }

  async createInstantMatch(options: CreateInstantMatchOptions): Promise<BookingEntity> {
    const {
      ownerId,
      workerId,
      petId,
      serviceType,
      durationMinutes,
      grossAmount,
      pickupLongitude,
      pickupLatitude,
      idempotencyKey,
      paymentToken,
    } = options;

    // 1. Validate idempotencyKey
    if (!idempotencyKey || idempotencyKey.length < 16) {
      throw new HttpError('Valid UUID idempotencyKey is required to prevent double billing', 400);
    }

    // Check existing booking with idempotencyKey
    const existing = await this.db.query(
      'SELECT id, owner_id, worker_id, pet_id, service_type, duration_minutes, status, gross_amount, commission_amount, worker_payout, gateway_ref, idempotency_key FROM bookings WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return {
        id: String(row.id),
        ownerId: String(row.owner_id),
        workerId: String(row.worker_id),
        petId: String(row.pet_id),
        serviceType: String(row.service_type),
        durationMinutes: Number(row.duration_minutes),
        status: row.status as BookingEntity['status'],
        grossAmount: Number(row.gross_amount),
        commissionAmount: Number(row.commission_amount),
        workerPayout: Number(row.worker_payout),
        gatewayRef: String(row.gateway_ref),
        idempotencyKey: String(row.idempotency_key),
      };
    }

    if (grossAmount <= 0) {
      throw new HttpError('Gross amount must be greater than 0', 400);
    }

    // 2. Calculate 15% platform commission and 85% worker payout
    const commissionAmount = Math.round(grossAmount * PLATFORM_COMMISSION_PERCENT);
    const workerPayout = grossAmount - commissionAmount;

    // 3. Pre-authorization hold on payment gateway
    const tempOrderId = `ord_${idempotencyKey.slice(0, 12)}`;
    const holdRes = await this.payment.createPreAuthHold(tempOrderId, grossAmount, paymentToken);

    // 4. Insert row into bookings table with status REQUESTED
    const insertQuery = `
      INSERT INTO bookings (
        owner_id, worker_id, pet_id, service_type, duration_minutes,
        status, pickup_location, gross_amount, commission_amount,
        worker_payout, gateway_ref, idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, 'REQUESTED', ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9, $10, $11, $12)
      RETURNING id, owner_id, worker_id, pet_id, service_type, duration_minutes, status, gross_amount, commission_amount, worker_payout, gateway_ref, idempotency_key
    `;

    const res = await this.db.query(insertQuery, [
      ownerId,
      workerId,
      petId,
      serviceType,
      durationMinutes,
      pickupLongitude,
      pickupLatitude,
      grossAmount,
      commissionAmount,
      workerPayout,
      holdRes.gatewayRef,
      idempotencyKey,
    ]);

    const created = res.rows[0];
    const bookingId = String(created.id);

    // 5. Write dispatch countdown job to Redis with 45s TTL
    const dispatchKey = `dispatch:${bookingId}`;
    await this.redis.set(dispatchKey, workerId, 'EX', DISPATCH_EXPIRY_SECONDS);

    // 6. Push dispatch notification with audio asset alert_dispatch.wav
    this.sendWorkerPushDispatch({
      bookingId,
      workerId,
      durationMinutes,
      workerPayout,
      sound: 'alert_dispatch.wav',
      expiresInSeconds: DISPATCH_EXPIRY_SECONDS,
    });

    return {
      id: bookingId,
      ownerId: String(created.owner_id),
      workerId: String(created.worker_id),
      petId: String(created.pet_id),
      serviceType: String(created.service_type),
      durationMinutes: Number(created.duration_minutes),
      status: 'REQUESTED',
      grossAmount,
      commissionAmount,
      workerPayout,
      gatewayRef: holdRes.gatewayRef,
      idempotencyKey,
    };
  }

  async respondToDispatch(
    bookingId: string,
    workerId: string,
    action: 'ACCEPT' | 'REJECT'
  ): Promise<{ status: string; message: string }> {
    // 1. Fetch booking
    const res = await this.db.query(
      'SELECT id, worker_id, status, gateway_ref FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (res.rows.length === 0) {
      throw new HttpError('Booking not found', 404);
    }

    const booking = res.rows[0];
    if (booking.worker_id !== workerId) {
      throw new HttpError('Forbidden: you are not the target worker for this booking', 403);
    }

    const dispatchKey = `dispatch:${bookingId}`;

    if (action === 'ACCEPT') {
      // Check if dispatch timer expired
      const dispatchActive = await this.redis.get(dispatchKey);
      if (!dispatchActive || booking.status !== 'REQUESTED') {
        throw new HttpError('Dispatch request has expired or has already been answered', 410);
      }

      // Transition to ACCEPTED & set worker is_online = false
      await this.db.query("UPDATE bookings SET status = 'ACCEPTED' WHERE id = $1", [bookingId]);
      await this.db.query('UPDATE worker_profiles SET is_online = FALSE WHERE id = $1', [workerId]);

      // Invalidate dispatch key
      await this.redis.del(dispatchKey);

      return {
        status: 'ACCEPTED',
        message: 'Booking successfully accepted. Status transitioned to ACCEPTED.',
      };
    } else {
      // Worker rejected: Void pre-auth hold and set status CANCELLED
      await this.db.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = $1", [bookingId]);

      if (booking.gateway_ref) {
        await this.payment.voidPreAuthHold(bookingId, String(booking.gateway_ref));
      }

      await this.redis.del(dispatchKey);

      return {
        status: 'CANCELLED',
        message: 'Booking rejected. Pre-authorization hold voided and funds released.',
      };
    }
  }

  async handleDispatchTimeout(bookingId: string): Promise<void> {
    const res = await this.db.query(
      "SELECT id, status, gateway_ref FROM bookings WHERE id = $1 AND status = 'REQUESTED'",
      [bookingId]
    );

    if (res.rows.length > 0) {
      const booking = res.rows[0];
      await this.db.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = $1", [bookingId]);

      if (booking.gateway_ref) {
        await this.payment.voidPreAuthHold(bookingId, String(booking.gateway_ref));
      }

      await this.redis.del(`dispatch:${bookingId}`);
    }
  }

  private sendWorkerPushDispatch(notification: WorkerDispatchNotification): void {
    this.lastDispatchNotification = notification;
    // Non-blocking high-priority FCM notification push
  }
}

export const bookingDispatchService = new BookingDispatchService();
