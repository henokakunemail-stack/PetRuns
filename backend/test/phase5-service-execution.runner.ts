import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceExecutionService,
  calculateHaversineDistanceMeters,
} from '../src/services/service-execution.service.ts';
import { MockMidtransPaymentGateway } from '../src/services/payment.service.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { DatabaseClient, type QueryResultRow } from '../src/db/client.ts';
import { HttpError } from '../src/services/otp.service.ts';

describe('Phase 5: Service Execution and Live Tracking', () => {
  it('Task 31: Photo check-in validates <= 100m GPS radius, starts booking, records initial route point', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();

    let bookingStatus = 'ACCEPTED';
    let startedAtDate: Date | null = null;
    let initialRoutePointSaved = false;

    // Center coordinates: Jakarta Monas (-6.1754, 106.8272)
    const pickupLat = -6.1754;
    const pickupLng = 106.8272;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('SELECT id, worker_id, status')) {
          return [
            {
              id: 'book-exec-1',
              worker_id: 'worker-exec-1',
              status: bookingStatus,
              pickup_lat: pickupLat,
              pickup_lng: pickupLng,
            },
          ];
        }
        if (queryText.includes("UPDATE bookings SET status = 'IN_PROGRESS'")) {
          bookingStatus = 'IN_PROGRESS';
          startedAtDate = p[0] as Date;
          return [];
        }
        if (queryText.includes('INSERT INTO route_points')) {
          initialRoutePointSaved = true;
          return [];
        }
        return [];
      },
    });

    const executionService = new ServiceExecutionService(mockDb, redis, payment);

    // 1. Worker is 40 meters away from pickup (within 100m)
    // 0.0003 deg latitude is ~33 meters
    const checkInResult = await executionService.checkInBooking({
      bookingId: 'book-exec-1',
      workerId: 'worker-exec-1',
      photoS3Key: 'checkins/proof_photo.jpg',
      latitude: pickupLat + 0.0003,
      longitude: pickupLng,
    });

    assert.equal(checkInResult.status, 'IN_PROGRESS');
    assert.equal(bookingStatus, 'IN_PROGRESS');
    assert.ok(checkInResult.distanceMeters <= 100);
    assert.ok(startedAtDate);
    assert.equal(initialRoutePointSaved, true);

    // 2. Reject if worker is > 100 meters away (reset status to ACCEPTED for test)
    bookingStatus = 'ACCEPTED';
    await assert.rejects(
      async () => {
        await executionService.checkInBooking({
          bookingId: 'book-exec-1',
          workerId: 'worker-exec-1',
          photoS3Key: 'checkins/proof_photo.jpg',
          latitude: pickupLat + 0.005,
          longitude: pickupLng,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).statusCode, 400);
        assert.ok(err.message.includes('within 100m'));
        return true;
      }
    );
  });

  it('Task 33: Real-time route point broadcasting and buffered batch persistence', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();
    const insertedPoints: QueryResultRow[] = [];

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('INSERT INTO route_points')) {
          insertedPoints.push({
            booking_id: p[0],
            longitude: p[1],
            latitude: p[2],
            speed_kmh: p[3],
          });
          return [];
        }
        return [];
      },
    });

    const executionService = new ServiceExecutionService(mockDb, redis, payment);

    const receivedLivePoints: unknown[] = [];
    // Subscribe owner to WebSocket route updates
    const unsubscribe = executionService.subscribeTracking('book-exec-2', (point) => {
      receivedLivePoints.push(point);
    });

    // Ingest 6 points to trigger auto-flush threshold
    for (let i = 0; i < 6; i++) {
      await executionService.broadcastRoutePoint({
        bookingId: 'book-exec-2',
        latitude: -6.2088 + i * 0.0001,
        longitude: 106.8456 + i * 0.0001,
        speedKmh: 4.5,
      });
    }

    assert.equal(receivedLivePoints.length, 6);
    assert.equal(insertedPoints.length, 6);

    unsubscribe();
  });

  it('Task 35: Atomic escrow capture and balanced double-entry ledger on completion', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();

    let bookingStatus = 'IN_PROGRESS';
    let workerIsOnline = false;
    const ledgerRows: Array<{ entry_type: string; account: string; amount: number }> = [];

    const grossAmount = 150000;
    const commissionAmount = 22500; // 15%
    const workerPayout = 127500; // 85%

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('SELECT id, worker_id, status')) {
          return [
            {
              id: 'book-exec-3',
              worker_id: 'worker-exec-3',
              status: bookingStatus,
              gross_amount: grossAmount,
              commission_amount: commissionAmount,
              worker_payout: workerPayout,
              gateway_ref: 'midtrans_hold_complete_test',
            },
          ];
        }
        if (queryText.includes("UPDATE bookings SET status = 'COMPLETED'")) {
          bookingStatus = 'COMPLETED';
          return [];
        }
        if (queryText.includes('UPDATE worker_profiles SET is_online = TRUE')) {
          workerIsOnline = true;
          return [];
        }
        if (queryText.includes('INSERT INTO ledger_entries')) {
          // Double-entry ledger: 1 debit, 2 credits
          ledgerRows.push({ entry_type: 'DEBIT', account: 'ESCROW_CAPTURE', amount: Number(p[1]) });
          ledgerRows.push({ entry_type: 'CREDIT', account: 'WORKER_PAYOUT', amount: Number(p[2]) });
          ledgerRows.push({ entry_type: 'CREDIT', account: 'PLATFORM_COMMISSION', amount: Number(p[3]) });
          return [];
        }
        return [];
      },
    });

    const executionService = new ServiceExecutionService(mockDb, redis, payment);

    const result = await executionService.completeBooking('book-exec-3', 'worker-exec-3');

    // 1. Status updated to COMPLETED & worker returned online
    assert.equal(result.status, 'COMPLETED');
    assert.equal(bookingStatus, 'COMPLETED');
    assert.equal(workerIsOnline, true);

    // 2. Payment captured via payment gateway
    assert.equal(payment.isCaptured('book-exec-3'), true);

    // 3. Double-entry ledger verification
    assert.equal(ledgerRows.length, 3);
    const debitTotal = ledgerRows
      .filter((r) => r.entry_type === 'DEBIT')
      .reduce((sum, r) => sum + r.amount, 0);
    const creditTotal = ledgerRows
      .filter((r) => r.entry_type === 'CREDIT')
      .reduce((sum, r) => sum + r.amount, 0);

    // Accounting invariant: Total Debits == Total Credits
    assert.equal(debitTotal, creditTotal);
    assert.equal(debitTotal, grossAmount);
    assert.equal(creditTotal, workerPayout + commissionAmount);
  });
});
