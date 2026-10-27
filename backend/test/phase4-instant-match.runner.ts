import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BookingDispatchService } from '../src/services/booking-dispatch.service.ts';
import { MockMidtransPaymentGateway } from '../src/services/payment.service.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { DatabaseClient, type QueryResultRow } from '../src/db/client.ts';
import { HttpError } from '../src/services/otp.service.ts';

describe('Phase 4: Instant Matching and Escrow Payment', () => {
  it('Task 24 & 25: Instant match enforces idempotency, 15% commission, 85% payout, and pre-auth hold', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();
    let storedBookingRow: QueryResultRow | null = null;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('SELECT id, owner_id, worker_id')) {
          return storedBookingRow ? [storedBookingRow] : [];
        }
        if (queryText.includes('INSERT INTO bookings')) {
          storedBookingRow = {
            id: 'book-uuid-1',
            owner_id: p[0],
            worker_id: p[1],
            pet_id: p[2],
            service_type: p[3],
            duration_minutes: p[4],
            status: 'REQUESTED',
            gross_amount: p[7],
            commission_amount: p[8],
            worker_payout: p[9],
            gateway_ref: p[10],
            idempotency_key: p[11],
          };
          return [storedBookingRow];
        }
        return [];
      },
    });

    const dispatchService = new BookingDispatchService(mockDb, redis, payment);

    const idempotencyKey = '12345678-1234-4234-8234-123456789abc';
    const grossAmount = 100000; // Rp 100.000

    // 1. Create instant match
    const booking = await dispatchService.createInstantMatch({
      ownerId: 'owner-1',
      workerId: 'worker-1',
      petId: 'pet-1',
      serviceType: 'WALK',
      durationMinutes: 60,
      grossAmount,
      pickupLongitude: 106.8456,
      pickupLatitude: -6.2088,
      idempotencyKey,
    });

    // 2. Validate calculations: 15% commission, 85% payout
    assert.equal(booking.grossAmount, 100000);
    assert.equal(booking.commissionAmount, 15000); // 15%
    assert.equal(booking.workerPayout, 85000); // 85%
    assert.equal(booking.status, 'REQUESTED');
    assert.ok(booking.gatewayRef.startsWith('midtrans_hold_'));

    // 3. Payment gateway holds active authorization
    assert.equal(payment.hasActiveHold(`ord_${idempotencyKey.slice(0, 12)}`), true);

    // 4. Redis dispatch countdown exists with 45s TTL
    const dispatchWorker = await redis.get(`dispatch:${booking.id}`);
    assert.equal(dispatchWorker, 'worker-1');
    const ttl = await redis.ttl(`dispatch:${booking.id}`);
    assert.ok(ttl <= 45 && ttl > 0);

    // 5. High-priority push dispatch notification recorded
    assert.ok(dispatchService.lastDispatchNotification);
    assert.equal(dispatchService.lastDispatchNotification!.sound, 'alert_dispatch.wav');
    assert.equal(dispatchService.lastDispatchNotification!.workerPayout, 85000);

    // 6. Idempotency test: duplicate request returns existing booking without double charging
    const duplicate = await dispatchService.createInstantMatch({
      ownerId: 'owner-1',
      workerId: 'worker-1',
      petId: 'pet-1',
      serviceType: 'WALK',
      durationMinutes: 60,
      grossAmount,
      pickupLongitude: 106.8456,
      pickupLatitude: -6.2088,
      idempotencyKey,
    });
    assert.equal(duplicate.id, booking.id);
  });

  it('Task 26 & 28: Worker accept transitions to ACCEPTED and unsets worker is_online', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();
    let bookingStatus = 'REQUESTED';
    let workerIsOnline = true;

    // Set active dispatch timer
    await redis.set('dispatch:book-uuid-2', 'worker-2', 'EX', 45);

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('SELECT id, worker_id, status')) {
          return [{ id: 'book-uuid-2', worker_id: 'worker-2', status: bookingStatus, gateway_ref: 'midtrans_hold_test' }];
        }
        if (queryText.includes("UPDATE bookings SET status = 'ACCEPTED'")) {
          bookingStatus = 'ACCEPTED';
          return [];
        }
        if (queryText.includes('UPDATE worker_profiles SET is_online = FALSE')) {
          workerIsOnline = false;
          return [];
        }
        return [];
      },
    });

    const dispatchService = new BookingDispatchService(mockDb, redis, payment);

    const res = await dispatchService.respondToDispatch('book-uuid-2', 'worker-2', 'ACCEPT');
    assert.equal(res.status, 'ACCEPTED');
    assert.equal(bookingStatus, 'ACCEPTED');
    assert.equal(workerIsOnline, false);

    // Dispatch key removed
    assert.equal(await redis.get('dispatch:book-uuid-2'), null);
  });

  it('Task 26 & 28: Worker reject transitions to CANCELLED and voids pre-auth hold', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();
    let bookingStatus = 'REQUESTED';

    await redis.set('dispatch:book-uuid-3', 'worker-3', 'EX', 45);

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('SELECT id, worker_id, status')) {
          return [{ id: 'book-uuid-3', worker_id: 'worker-3', status: bookingStatus, gateway_ref: 'midtrans_hold_ref3' }];
        }
        if (queryText.includes("UPDATE bookings SET status = 'CANCELLED'")) {
          bookingStatus = 'CANCELLED';
          return [];
        }
        return [];
      },
    });

    const dispatchService = new BookingDispatchService(mockDb, redis, payment);

    const res = await dispatchService.respondToDispatch('book-uuid-3', 'worker-3', 'REJECT');
    assert.equal(res.status, 'CANCELLED');
    assert.equal(bookingStatus, 'CANCELLED');
    assert.equal(payment.isVoided('book-uuid-3'), true);
  });

  it('Task 26: Dispatch timeout releases pre-auth hold and marks booking CANCELLED', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();
    let bookingStatus = 'REQUESTED';

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('SELECT id, status, gateway_ref')) {
          return [{ id: 'book-uuid-4', status: bookingStatus, gateway_ref: 'midtrans_hold_ref4' }];
        }
        if (queryText.includes("UPDATE bookings SET status = 'CANCELLED'")) {
          bookingStatus = 'CANCELLED';
          return [];
        }
        return [];
      },
    });

    const dispatchService = new BookingDispatchService(mockDb, redis, payment);
    await dispatchService.handleDispatchTimeout('book-uuid-4');

    assert.equal(bookingStatus, 'CANCELLED');
    assert.equal(payment.isVoided('book-uuid-4'), true);
  });
});
