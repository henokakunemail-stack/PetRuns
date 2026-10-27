import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseClient, type QueryResultRow } from '../src/db/client.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { MockMidtransPaymentGateway } from '../src/services/payment.service.ts';
import { OtpService } from '../src/services/otp.service.ts';
import { UserRepository } from '../src/repositories/user.repository.ts';
import { KycService, type VerihubsClient } from '../src/services/kyc.service.ts';
import { PricingService } from '../src/services/pricing.service.ts';
import { GeolocationService } from '../src/services/geolocation.service.ts';
import { BookingDispatchService } from '../src/services/booking-dispatch.service.ts';
import { ChatService } from '../src/services/chat.service.ts';
import { ServiceExecutionService } from '../src/services/service-execution.service.ts';
import { ReviewService } from '../src/services/review.service.ts';

describe('End-to-End Lifecycle: PetMatch Full Flow', () => {
  it('Executes complete user journey from onboarding to payment settlement and review', async () => {
    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();

    // In-memory relational tables
    const dbUsers = new Map<string, QueryResultRow>();
    const dbWorkerProfiles = new Map<string, QueryResultRow>();
    const dbPricing = new Map<string, QueryResultRow>();
    const dbBookings = new Map<string, QueryResultRow>();
    const dbChatRooms = new Map<string, QueryResultRow>();
    const dbChatMessages: QueryResultRow[] = [];
    const dbRoutePoints: QueryResultRow[] = [];
    const dbLedgerEntries: QueryResultRow[] = [];
    const dbReviews = new Map<string, QueryResultRow>();

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];

        // Users & Auth
        if (queryText.includes('SELECT id, phone_hash, role FROM users WHERE phone_hash = $1')) {
          for (const u of dbUsers.values()) {
            if (u.phone_hash === p[0]) return [u];
          }
          return [];
        }
        if (queryText.includes('INSERT INTO users (phone_encrypted, phone_hash, role)')) {
          const id = `usr-${dbUsers.size + 1}`;
          const row = { id, phone_encrypted: p[0], phone_hash: p[1], role: p[2] };
          dbUsers.set(id, row);
          return [row];
        }

        // Worker Profiles & KYC
        if (queryText.includes('SELECT id, user_id, verification_status FROM worker_profiles WHERE id = $1')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          return w ? [w] : [];
        }
        if (queryText.includes('UPDATE worker_profiles SET ktp_encrypted = $1, selfie_s3_key = $2, verification_status = $3')) {
          const w = dbWorkerProfiles.get(String(p[3]));
          if (w) {
            w.verification_status = p[2];
            w.ktp_encrypted = p[0];
            w.selfie_s3_key = p[1];
          }
          return [];
        }
        if (queryText.includes('UPDATE worker_profiles SET is_online = FALSE WHERE id = $1')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          if (w) w.is_online = false;
          return [];
        }
        if (queryText.includes('UPDATE worker_profiles SET is_online = TRUE WHERE id = $1')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          if (w) w.is_online = true;
          return [];
        }

        // Pricing
        if (queryText.includes('INSERT INTO worker_pricing')) {
          const row = {
            id: `prc-${dbPricing.size + 1}`,
            worker_id: p[0],
            pet_type: p[1],
            price_30m: p[2],
            price_60m: p[3],
            price_120m: p[4],
            price_overnight: p[5],
          };
          dbPricing.set(String(p[0]), row);
          return [row];
        }

        // Discovery & Geolocation
        if (queryText.includes('SELECT id, verification_status, is_online FROM worker_profiles WHERE id = $1')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          return w ? [w] : [];
        }
        if (queryText.includes('SELECT wp.id, u.full_name, wp.bio')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          const prc = dbPricing.get(String(p[0]));
          if (!w) return [];
          return [
            {
              id: w.id,
              full_name: 'Budi Santoso',
              bio: 'Pecinta anjing profesional',
              profile_photo_url: 'https://cdn.petmatch.id/budi.jpg',
              rating_avg: w.rating_avg || 0,
              total_reviews: w.total_reviews || 0,
              price_30m: prc?.price_30m || 50000,
              price_60m: prc?.price_60m || 80000,
              price_120m: prc?.price_120m || 140000,
              price_overnight: prc?.price_overnight || 250000,
              supported_pet_types: ['DOG_SMALL', 'DOG_MEDIUM'],
            },
          ];
        }

        // Bookings
        if (queryText.includes('INSERT INTO bookings')) {
          const id = `booking-${dbBookings.size + 1}`;
          const row = {
            id,
            owner_id: p[0],
            worker_id: p[1],
            pet_id: p[2],
            service_type: p[3],
            duration_minutes: p[4],
            status: 'REQUESTED',
            pickup_lat: p[6],
            pickup_lng: p[5],
            gross_amount: p[7],
            commission_amount: p[8],
            worker_payout: p[9],
            gateway_ref: p[10],
            idempotency_key: p[11],
          };
          dbBookings.set(id, row);
          return [row];
        }
        if (queryText.includes('SELECT id, owner_id, worker_id, pet_id, service_type, duration_minutes, status, gross_amount, commission_amount, worker_payout, gateway_ref, idempotency_key FROM bookings WHERE idempotency_key = $1')) {
          for (const b of dbBookings.values()) {
            if (b.idempotency_key === p[0]) return [b];
          }
          return [];
        }
        if (queryText.includes('SELECT id, worker_id, status, gateway_ref FROM bookings WHERE id = $1')) {
          const b = dbBookings.get(String(p[0]));
          return b ? [b] : [];
        }
        if (queryText.includes("UPDATE bookings SET status = 'ACCEPTED' WHERE id = $1")) {
          const b = dbBookings.get(String(p[0]));
          if (b) b.status = 'ACCEPTED';
          return [];
        }
        if (queryText.includes('SELECT id, worker_id, status, ST_X(pickup_location::geometry)')) {
          const b = dbBookings.get(String(p[0]));
          if (!b) return [];
          return [
            {
              id: b.id,
              worker_id: b.worker_id,
              status: b.status,
              pickup_lng: b.pickup_lng,
              pickup_lat: b.pickup_lat,
            },
          ];
        }
        if (queryText.includes("UPDATE bookings SET status = 'IN_PROGRESS', started_at = $1 WHERE id = $2")) {
          const b = dbBookings.get(String(p[1]));
          if (b) {
            b.status = 'IN_PROGRESS';
            b.started_at = p[0];
          }
          return [];
        }
        if (queryText.includes('SELECT id, worker_id, status, gross_amount, commission_amount, worker_payout, gateway_ref FROM bookings WHERE id = $1')) {
          const b = dbBookings.get(String(p[0]));
          return b ? [b] : [];
        }
        if (queryText.includes("UPDATE bookings SET status = 'COMPLETED', completed_at = $1 WHERE id = $2")) {
          const b = dbBookings.get(String(p[1]));
          if (b) {
            b.status = 'COMPLETED';
            b.completed_at = p[0];
          }
          return [];
        }

        // Chat
        if (queryText.includes('SELECT id, owner_id, worker_id, booking_id, created_at FROM chat_rooms')) {
          for (const cr of dbChatRooms.values()) {
            if (cr.owner_id === p[0] && cr.worker_id === p[1]) return [cr];
          }
          return [];
        }
        if (queryText.includes('INSERT INTO chat_rooms')) {
          const id = `room-${dbChatRooms.size + 1}`;
          const row = { id, owner_id: p[0], worker_id: p[1], booking_id: p[2] || null };
          dbChatRooms.set(id, row);
          return [row];
        }
        if (queryText.includes('SELECT id, owner_id, worker_id FROM chat_rooms WHERE id = $1')) {
          const r = dbChatRooms.get(String(p[0]));
          return r ? [r] : [];
        }
        if (queryText.includes('INSERT INTO chat_messages')) {
          const row = {
            id: `msg-${dbChatMessages.length + 1}`,
            room_id: p[0],
            sender_id: p[1],
            content_encrypted: p[2],
            is_read: false,
            created_at: new Date(),
          };
          dbChatMessages.push(row);
          return [row];
        }
        if (queryText.includes('SELECT id, room_id, sender_id, content_encrypted, is_read, created_at FROM chat_messages')) {
          return dbChatMessages.filter((m) => m.room_id === p[0]);
        }
        if (queryText.includes('UPDATE chat_messages SET is_read = TRUE')) {
          return [];
        }

        // Route Points
        if (queryText.includes('INSERT INTO route_points')) {
          dbRoutePoints.push({
            booking_id: p[0],
            longitude: p[1],
            latitude: p[2],
            speed_kmh: p[3],
            recorded_at: p[4],
          });
          return [];
        }

        // Ledger
        if (queryText.includes('INSERT INTO ledger_entries')) {
          dbLedgerEntries.push({
            booking_id: p[0],
            debit_capture: p[1],
            credit_payout: p[2],
            credit_comm: p[3],
          });
          return [];
        }

        // Reviews
        if (queryText.includes('SELECT id, owner_id, worker_id, status FROM bookings WHERE id = $1')) {
          const b = dbBookings.get(String(p[0]));
          return b ? [b] : [];
        }
        if (queryText.includes('SELECT id FROM reviews WHERE booking_id = $1')) {
          const r = dbReviews.get(String(p[0]));
          return r ? [r] : [];
        }
        if (queryText.includes('INSERT INTO reviews')) {
          const row = {
            id: `rev-${dbReviews.size + 1}`,
            booking_id: p[0],
            owner_id: p[1],
            worker_id: p[2],
            score: p[3],
            comment: p[4],
            created_at: new Date(),
          };
          dbReviews.set(String(p[0]), row);

          // Simulate DB Trigger recalculation
          const worker = dbWorkerProfiles.get(String(p[2]));
          if (worker) {
            worker.rating_avg = Number(p[3]);
            worker.total_reviews = 1;
          }
          return [row];
        }
        if (queryText.includes("WHERE b.owner_id = $1 AND b.status = 'COMPLETED' AND r.id IS NULL")) {
          // Check for pending review
          for (const b of dbBookings.values()) {
            if (b.owner_id === p[0] && b.status === 'COMPLETED' && !dbReviews.has(String(b.id))) {
              return [
                {
                  booking_id: b.id,
                  worker_id: b.worker_id,
                  worker_name: 'Budi Santoso',
                  completed_at: b.completed_at,
                },
              ];
            }
          }
          return [];
        }

        return [];
      },
    });

    // Seed worker profile
    dbWorkerProfiles.set('worker-e2e-1', {
      id: 'worker-e2e-1',
      user_id: 'usr-worker',
      verification_status: 'PENDING',
      is_online: false,
      rating_avg: 0,
      total_reviews: 0,
    });

    // ----------------------------------------------------
    // STEP 1: Owner & Worker Authentication via OTP
    // ----------------------------------------------------
    const userRepo = new UserRepository(mockDb);
    const otpService = new OtpService(redis, userRepo);
    const otpRes = await otpService.sendOtp('+6281234567890');
    const ownerAuth = await otpService.verifyOtp('+6281234567890', otpRes.otpCode);
    assert.ok(ownerAuth.accessToken);
    assert.equal(ownerAuth.user.role, 'OWNER');
    const ownerId = ownerAuth.user.id;

    // ----------------------------------------------------
    // STEP 2: Worker Biometric Verification & Pricing Setup
    // ----------------------------------------------------
    const mockVerihubs: VerihubsClient = {
      async verifyFaceAndKtp() {
        return { similarityScore: 92.5, isMatch: true };
      },
    };
    const kycService = new KycService(mockDb, redis, mockVerihubs);
    const kycResult = await kycService.verifyBiometricAndKtp({
      workerId: 'worker-e2e-1',
      ktpNumber: '3171012345670001',
      selfieS3Key: 'kyc/selfie.jpg',
      ktpS3Key: 'kyc/ktp.jpg',
    });
    assert.equal(kycResult.status, 'VERIFIED');

    const pricingService = new PricingService(mockDb, redis);
    await pricingService.savePricing({
      workerId: 'worker-e2e-1',
      petType: 'DOG_MEDIUM',
      price30m: 60000,
      price60m: 100000,
      price120m: 180000,
      priceOvernight: 300000,
    });

    // ----------------------------------------------------
    // STEP 3: Worker Location Ping & Owner Discovery
    // ----------------------------------------------------
    const geoService = new GeolocationService(mockDb, redis);
    const pickupLat = -6.2088;
    const pickupLng = 106.8456;

    // Worker goes online near pickup
    const pingRes = await geoService.pingLocation({
      workerId: 'worker-e2e-1',
      latitude: pickupLat + 0.002, // ~220m away
      longitude: pickupLng,
      accuracyMeters: 10,
    });
    assert.equal(pingRes.isOnline, true);

    // Owner searches nearby
    const nearbyWorkers = await geoService.discoverNearbyWorkers({
      latitude: pickupLat,
      longitude: pickupLng,
      radiusKm: 5,
    });
    assert.equal(nearbyWorkers.length, 1);
    assert.equal(nearbyWorkers[0].id, 'worker-e2e-1');

    // ----------------------------------------------------
    // STEP 4: Owner Instant Match & Pre-Auth Escrow Hold (15% platform, 85% worker)
    // ----------------------------------------------------
    const dispatchService = new BookingDispatchService(mockDb, redis, payment);
    const grossAmount = 100000; // Rp 100.000 (60 menit)
    const idempotencyKey = '99998888-7777-4666-8555-123456789abc';

    const booking = await dispatchService.createInstantMatch({
      ownerId,
      workerId: 'worker-e2e-1',
      petId: 'pet-e2e-1',
      serviceType: 'WALK',
      durationMinutes: 60,
      grossAmount,
      pickupLatitude: pickupLat,
      pickupLongitude: pickupLng,
      idempotencyKey,
    });

    assert.equal(booking.status, 'REQUESTED');
    assert.equal(booking.commissionAmount, 15000); // 15%
    assert.equal(booking.workerPayout, 85000); // 85%
    assert.equal(payment.hasActiveHold(`ord_${idempotencyKey.slice(0, 12)}`), true);

    // ----------------------------------------------------
    // STEP 5: Worker Accepts Dispatch (transitions to ACCEPTED, is_online = false)
    // ----------------------------------------------------
    const acceptRes = await dispatchService.respondToDispatch(booking.id, 'worker-e2e-1', 'ACCEPT');
    assert.equal(acceptRes.status, 'ACCEPTED');
    assert.equal(dbWorkerProfiles.get('worker-e2e-1')?.is_online, false);

    // ----------------------------------------------------
    // STEP 6: Real-Time Chat Communication
    // ----------------------------------------------------
    const chatService = new ChatService(mockDb, redis);
    const room = await chatService.getOrCreateRoom(ownerId, 'worker-e2e-1', booking.id);
    const sentMsg = await chatService.sendMessage({
      roomId: room.id,
      senderId: ownerId,
      content: 'Halo kak, anjing saya Golden Retriever ramah ya!',
    });
    assert.equal(sentMsg.content, 'Halo kak, anjing saya Golden Retriever ramah ya!');

    const messages = await chatService.getMessages({
      roomId: room.id,
      userId: 'worker-e2e-1',
    });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, 'Halo kak, anjing saya Golden Retriever ramah ya!');

    // ----------------------------------------------------
    // STEP 7: Worker Photo Check-In within 100m (transitions to IN_PROGRESS)
    // ----------------------------------------------------
    const execService = new ServiceExecutionService(mockDb, redis, payment);
    const checkIn = await execService.checkInBooking({
      bookingId: booking.id,
      workerId: 'worker-e2e-1',
      photoS3Key: 'checkins/proof_1.jpg',
      latitude: pickupLat + 0.0004, // ~45 meters away
      longitude: pickupLng,
    });
    assert.equal(checkIn.status, 'IN_PROGRESS');
    assert.ok(checkIn.distanceMeters <= 100);

    // ----------------------------------------------------
    // STEP 8: Live Route Tracking Streaming & Batch Buffer
    // ----------------------------------------------------
    await execService.broadcastRoutePoint({
      bookingId: booking.id,
      latitude: pickupLat + 0.0005,
      longitude: pickupLng + 0.0005,
      speedKmh: 4.2,
    });

    // ----------------------------------------------------
    // STEP 9: Complete Service: Escrow Captured & Balanced Double-Entry Ledger
    // ----------------------------------------------------
    const completeResult = await execService.completeBooking(booking.id, 'worker-e2e-1');
    assert.equal(completeResult.status, 'COMPLETED');
    assert.equal(payment.isCaptured(booking.id), true);
    assert.equal(dbWorkerProfiles.get('worker-e2e-1')?.is_online, true); // Worker online again

    // Invariant: Debit Escrow == Credit Worker + Credit Platform
    assert.equal(dbLedgerEntries.length, 1);
    assert.equal(Number(dbLedgerEntries[0].debit_capture), 100000);
    assert.equal(Number(dbLedgerEntries[0].credit_payout), 85000);
    assert.equal(Number(dbLedgerEntries[0].credit_comm), 15000);

    // ----------------------------------------------------
    // STEP 10: Owner Submits 5-Star Review & Profile Eviction
    // ----------------------------------------------------
    const reviewService = new ReviewService(mockDb, redis);
    const pendingReview = await reviewService.getPendingReview(ownerId);
    assert.ok(pendingReview);
    assert.equal(pendingReview!.bookingId, booking.id);

    const reviewRes = await reviewService.submitReview({
      bookingId: booking.id,
      ownerId,
      score: 5,
      comment: 'Pelayanan sangat memuaskan dan anjing saya senang!',
    });
    assert.equal(reviewRes.score, 5);

    // Rating updated
    assert.equal(dbWorkerProfiles.get('worker-e2e-1')?.rating_avg, 5);
    assert.equal(dbWorkerProfiles.get('worker-e2e-1')?.total_reviews, 1);

    // Pending review cleared
    const pendingAfter = await reviewService.getPendingReview(ownerId);
    assert.equal(pendingAfter, null);
  });
});
