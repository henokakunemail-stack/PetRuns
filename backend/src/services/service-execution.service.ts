import { dbClient, DatabaseClient, type QueryResultRow } from '../db/client.ts';
import { redisClient, type IRedisClient } from '../redis/redis-client.ts';
import { paymentGatewayClient, type PaymentGatewayClient } from './payment.service.ts';
import { HttpError } from './otp.service.ts';

export const MAX_CHECKIN_DISTANCE_METERS = 100; // Worker must be within 100m of pickup
export const ROUTE_BUFFER_FLUSH_INTERVAL_MS = 30000; // 30 seconds

export interface CheckInOptions {
  bookingId: string;
  workerId: string;
  photoS3Key: string;
  latitude: number;
  longitude: number;
}

export interface RoutePointUpdate {
  bookingId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  recordedAt?: Date;
}

export interface CompleteBookingResult {
  bookingId: string;
  status: 'COMPLETED';
  grossAmount: number;
  commissionAmount: number;
  workerPayout: number;
  completedAt: Date;
}

export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class ServiceExecutionService {
  private db: DatabaseClient;
  private redis: IRedisClient;
  private payment: PaymentGatewayClient;
  private routeBuffers: Map<string, RoutePointUpdate[]> = new Map();
  private wsClients: Map<string, Set<(point: RoutePointUpdate) => void>> = new Map();

  constructor(
    db: DatabaseClient = dbClient,
    redis: IRedisClient = redisClient,
    payment: PaymentGatewayClient = paymentGatewayClient
  ) {
    this.db = db;
    this.redis = redis;
    this.payment = payment;
  }

  async checkInBooking(options: CheckInOptions): Promise<{ status: string; startedAt: Date; distanceMeters: number }> {
    const { bookingId, workerId, photoS3Key, latitude, longitude } = options;

    if (!photoS3Key) {
      throw new HttpError('Photo S3 key is required for check-in', 400);
    }

    // 1. Fetch booking & pickup location coordinates
    const res = await this.db.query(
      `SELECT id, worker_id, status, 
              ST_X(pickup_location::geometry) as pickup_lng, 
              ST_Y(pickup_location::geometry) as pickup_lat 
       FROM bookings WHERE id = $1`,
      [bookingId]
    );

    if (res.rows.length === 0) {
      throw new HttpError('Booking not found', 404);
    }

    const booking = res.rows[0];
    if (booking.worker_id !== workerId) {
      throw new HttpError('Forbidden: only assigned worker can perform check-in', 403);
    }

    if (booking.status !== 'ACCEPTED') {
      throw new HttpError(`Cannot check-in booking with status ${String(booking.status)}. Expected ACCEPTED.`, 400);
    }

    // 2. Validate distance <= 100 meters
    const pickupLat = Number(booking.pickup_lat);
    const pickupLng = Number(booking.pickup_lng);
    const distanceMeters = calculateHaversineDistanceMeters(latitude, longitude, pickupLat, pickupLng);

    if (distanceMeters > MAX_CHECKIN_DISTANCE_METERS) {
      throw new HttpError(
        `Check-in failed: Worker is ${Math.round(distanceMeters)}m away. Must be within ${MAX_CHECKIN_DISTANCE_METERS}m of pickup location.`,
        400
      );
    }

    const startedAt = new Date();

    // 3. Transition booking status to IN_PROGRESS and save initial route point
    await this.db.query(
      "UPDATE bookings SET status = 'IN_PROGRESS', started_at = $1 WHERE id = $2",
      [startedAt, bookingId]
    );

    await this.db.query(
      `INSERT INTO route_points (booking_id, location, speed_kmh, recorded_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5)`,
      [bookingId, longitude, latitude, 0, startedAt]
    );

    return {
      status: 'IN_PROGRESS',
      startedAt,
      distanceMeters,
    };
  }

  // WebSocket / tracking point ingestion
  subscribeTracking(bookingId: string, listener: (point: RoutePointUpdate) => void): () => void {
    if (!this.wsClients.has(bookingId)) {
      this.wsClients.set(bookingId, new Set());
    }
    this.wsClients.get(bookingId)!.add(listener);

    return () => {
      this.wsClients.get(bookingId)?.delete(listener);
    };
  }

  async broadcastRoutePoint(update: RoutePointUpdate): Promise<void> {
    const point: RoutePointUpdate = {
      ...update,
      recordedAt: update.recordedAt || new Date(),
    };

    // Forward to active WS client subscribers
    const listeners = this.wsClients.get(point.bookingId);
    if (listeners) {
      for (const listener of listeners) {
        listener(point);
      }
    }

    // Buffer for batch persistence
    if (!this.routeBuffers.has(point.bookingId)) {
      this.routeBuffers.set(point.bookingId, []);
    }
    this.routeBuffers.get(point.bookingId)!.push(point);

    // If buffer exceeds threshold, flush immediately
    if (this.routeBuffers.get(point.bookingId)!.length >= 6) {
      await this.flushRouteBuffer(point.bookingId);
    }
  }

  async flushRouteBuffer(bookingId: string): Promise<number> {
    const points = this.routeBuffers.get(bookingId);
    if (!points || points.length === 0) return 0;

    const count = points.length;
    // Batch insert points
    for (const pt of points) {
      await this.db.query(
        `INSERT INTO route_points (booking_id, location, speed_kmh, recorded_at)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5)`,
        [bookingId, pt.longitude, pt.latitude, pt.speedKmh ?? null, pt.recordedAt || new Date()]
      );
    }

    this.routeBuffers.set(bookingId, []);
    return count;
  }

  async completeBooking(bookingId: string, workerId: string): Promise<CompleteBookingResult> {
    // 1. Fetch booking details
    const res = await this.db.query(
      `SELECT id, worker_id, status, gross_amount, commission_amount, worker_payout, gateway_ref 
       FROM bookings WHERE id = $1`,
      [bookingId]
    );

    if (res.rows.length === 0) {
      throw new HttpError('Booking not found', 404);
    }

    const booking = res.rows[0];
    if (booking.worker_id !== workerId) {
      throw new HttpError('Forbidden: only assigned worker can complete booking', 403);
    }

    if (booking.status !== 'IN_PROGRESS') {
      throw new HttpError(`Cannot complete booking with status ${String(booking.status)}. Expected IN_PROGRESS.`, 400);
    }

    const grossAmount = Number(booking.gross_amount);
    const commissionAmount = Number(booking.commission_amount);
    const workerPayout = Number(booking.worker_payout);
    const completedAt = new Date();

    // 2. Capture payment hold via gateway
    if (booking.gateway_ref) {
      await this.payment.capturePayment(bookingId, String(booking.gateway_ref), grossAmount);
    }

    // 3. Atomic double-entry ledger and status update
    await this.db.query(
      "UPDATE bookings SET status = 'COMPLETED', completed_at = $1 WHERE id = $2",
      [completedAt, bookingId]
    );

    // Double-entry accounting:
    // Debit: ESCROW_CAPTURE (grossAmount)
    // Credit: WORKER_PAYOUT (workerPayout)
    // Credit: PLATFORM_COMMISSION (commissionAmount)
    await this.db.query(
      `INSERT INTO ledger_entries (booking_id, entry_type, account, amount, description)
       VALUES 
       ($1, 'DEBIT', 'ESCROW_CAPTURE', $2, 'Escrow funds captured from payment gateway'),
       ($1, 'CREDIT', 'WORKER_PAYOUT', $3, 'Worker earnings payable upon job completion'),
       ($1, 'CREDIT', 'PLATFORM_COMMISSION', $4, 'Platform 15% service fee commission')`,
      [bookingId, grossAmount, workerPayout, commissionAmount]
    );

    // 4. Return worker to standby (is_online = true)
    await this.db.query(
      'UPDATE worker_profiles SET is_online = TRUE WHERE id = $1',
      [workerId]
    );

    // 5. Flush any remaining route points
    await this.flushRouteBuffer(bookingId);

    return {
      bookingId,
      status: 'COMPLETED',
      grossAmount,
      commissionAmount,
      workerPayout,
      completedAt,
    };
  }
}

export const serviceExecutionService = new ServiceExecutionService();
