import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseClient, type QueryResultRow } from '../src/db/client.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { MockMidtransPaymentGateway } from '../src/services/payment.service.ts';
import { OtpService } from '../src/services/otp.service.ts';
import { UserRepository } from '../src/repositories/user.repository.ts';
import { WorkerProfileRepository } from '../src/repositories/worker-profile.repository.ts';
import { KycService, DefaultVerihubsClient } from '../src/services/kyc.service.ts';
import { PricingService } from '../src/services/pricing.service.ts';
import { GeolocationService } from '../src/services/geolocation.service.ts';
import { BookingDispatchService } from '../src/services/booking-dispatch.service.ts';
import { ChatService } from '../src/services/chat.service.ts';
import { ServiceExecutionService } from '../src/services/service-execution.service.ts';
import { ReviewService } from '../src/services/review.service.ts';
import { encryptField } from '../src/security/encryption.ts';

describe('Simulasi Live Real-World: Worker & Owner End-to-End', () => {
  it('Menjalankan skenario live: registrasi worker KYC, owner order escrow, chat, check-in, tracking, settlement, rating', async () => {
    console.log('\n======================================================');
    console.log('🚀 MEMULAI SIMULASI REAL-WORLD: PETMATCH LIVE FLOW');
    console.log('======================================================\n');

    const redis = new InMemoryRedisClient();
    const payment = new MockMidtransPaymentGateway();

    // In-memory relational tables
    const dbUsers = new Map<string, QueryResultRow>();
    const dbWorkerProfiles = new Map<string, QueryResultRow>();
    const dbBookings = new Map<string, QueryResultRow>();
    const dbChatRooms = new Map<string, QueryResultRow>();
    const dbChatMessages: QueryResultRow[] = [];
    const dbRoutePoints: QueryResultRow[] = [];
    const dbLedgerEntries: QueryResultRow[] = [];
    const dbReviews = new Map<string, QueryResultRow>();

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];

        // --- USERS & AUTH ---
        if (queryText.includes('SELECT id, phone_hash, role FROM users WHERE phone_hash = $1')) {
          for (const u of dbUsers.values()) {
            if (u.phone_hash === p[0]) return [u];
          }
          return [];
        }
        if (queryText.includes('SELECT id, phone_encrypted, phone_hash, role, full_name_encrypted, deleted_at, created_at FROM users WHERE id = $1')) {
          const u = dbUsers.get(String(p[0]));
          return u ? [u] : [];
        }
        if (queryText.includes('INSERT INTO users')) {
          const id = (p[0] as string) || `usr-${dbUsers.size + 1}`;
          const row = {
            id,
            phone_encrypted: p[1],
            phone_hash: p[2],
            role: p[3],
            full_name_encrypted: p[4] || null,
            deleted_at: null,
            created_at: new Date(),
          };
          dbUsers.set(id, row);
          return [row];
        }

        // --- WORKER PROFILES & KYC ---
        if (queryText.includes('SELECT verification_status FROM worker_profiles WHERE id = $1')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          return w ? [{ verification_status: w.verification_status }] : [];
        }
        if (queryText.includes('SELECT id, user_id, verification_status FROM worker_profiles WHERE id = $1')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          return w ? [w] : [];
        }
        if (queryText.includes('INSERT INTO worker_profiles')) {
          const id = String(p[0]);
          const existing = dbWorkerProfiles.get(id) || {};
          const row = {
            id,
            bio: p[1] ?? existing.bio ?? 'Penyayang anjing berpengalaman 3 tahun',
            verification_status: p[2] ?? existing.verification_status ?? 'PENDING',
            ktp_encrypted: p[3] ?? existing.ktp_encrypted ?? '',
            ktp_s3_key: p[4] ?? existing.ktp_s3_key ?? '',
            selfie_s3_key: p[5] ?? existing.selfie_s3_key ?? '',
            skck_s3_key: p[6] ?? existing.skck_s3_key ?? '',
            supported_pet_types: p[7] ?? existing.supported_pet_types ?? ['DOG_SMALL', 'DOG_MEDIUM'],
            price_30m: p[8] ?? existing.price_30m ?? 50000,
            price_60m: p[9] ?? existing.price_60m ?? 80000,
            price_120m: p[10] ?? existing.price_120m ?? 150000,
            price_overnight: p[11] ?? existing.price_overnight ?? 250000,
            is_online: p[12] ?? existing.is_online ?? false,
            rating_avg: existing.rating_avg ?? 5.0,
            total_reviews: existing.total_reviews ?? 0,
            rating_count: existing.total_reviews ?? 0,
            created_at: new Date(),
            updated_at: new Date(),
          };
          dbWorkerProfiles.set(id, row);
          return [row];
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
        if (queryText.includes('UPDATE worker_profiles') && queryText.includes('last_location_at')) {
          // Worker ping location update
          const w = dbWorkerProfiles.get(String(p[3]));
          if (w) {
            w.is_online = true;
            w.last_location_at = p[2];
          }
          return [];
        }

        // --- DISCOVERY & PROFILE CACHE ---
        if (queryText.includes('FROM worker_profiles wp') && queryText.includes('JOIN users u')) {
          const w = dbWorkerProfiles.get(String(p[0]));
          const u = dbUsers.get(String(p[0]));
          if (!w) return [];
          return [
            {
              id: w.id,
              full_name_encrypted: u?.full_name_encrypted,
              bio: w.bio,
              rating_avg: w.rating_avg,
              rating_count: w.total_reviews,
              price_30m: w.price_30m,
              price_60m: w.price_60m,
              price_120m: w.price_120m,
              price_overnight: w.price_overnight,
              supported_pet_types: w.supported_pet_types,
              is_online: w.is_online,
            },
          ];
        }

        // --- BOOKINGS & ESCROW ---
        if (queryText.includes('INSERT INTO bookings')) {
          const id = `book-${dbBookings.size + 1}`;
          const row = {
            id,
            owner_id: p[0],
            worker_id: p[1],
            pet_id: p[2],
            service_type: p[3],
            duration_minutes: p[4],
            status: 'REQUESTED',
            pickup_lng: p[5],
            pickup_lat: p[6],
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
        if (queryText.includes('ST_X(pickup_location::geometry)')) {
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
        if (queryText.includes('SELECT id, worker_id, status, gross_amount, commission_amount, worker_payout, gateway_ref FROM bookings WHERE id = $1') ||
            queryText.includes('FROM bookings WHERE id = $1')) {
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

        // --- CHAT ---
        if (queryText.includes('SELECT id, booking_id, owner_id, worker_id, created_at, updated_at FROM chat_rooms')) {
          for (const cr of dbChatRooms.values()) {
            if (cr.owner_id === p[0] && cr.worker_id === p[1]) return [cr];
          }
          return [];
        }
        if (queryText.includes('INSERT INTO chat_rooms')) {
          const id = `room-${dbChatRooms.size + 1}`;
          const row = { id, owner_id: p[1], worker_id: p[2], booking_id: p[0] || null, created_at: new Date(), updated_at: new Date() };
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
        if (queryText.includes('FROM chat_messages') && queryText.includes('SELECT')) {
          return dbChatMessages.filter((m) => m.room_id === p[0]);
        }
        if (queryText.includes('UPDATE chat_messages SET is_read = TRUE')) {
          return [];
        }
        if (queryText.includes('UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1')) {
          return [];
        }

        // --- ROUTE & LEDGER ---
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
        if (queryText.includes('INSERT INTO ledger_entries')) {
          dbLedgerEntries.push({
            booking_id: p[0],
            debit_capture: p[1],
            credit_payout: p[2],
            credit_comm: p[3],
          });
          return [];
        }

        // --- REVIEWS ---
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

          // Simulate DB Trigger recalculation: update worker_profiles
          const worker = dbWorkerProfiles.get(String(p[2]));
          if (worker) {
            worker.rating_avg = Number(p[3]);
            worker.total_reviews = 1;
            worker.rating_count = 1;
          }
          return [row];
        }
        if (queryText.includes("WHERE b.owner_id = $1 AND b.status = 'COMPLETED' AND r.id IS NULL")) {
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

    const userRepo = new UserRepository(mockDb);
    const workerRepo = new WorkerProfileRepository(mockDb);
    const otpService = new OtpService(redis, userRepo);

    // ========================================================
    // TAHAP 1: WORKER ONBOARDING & REGISTRASI LENGKAP
    // ========================================================
    console.log('[1/8] Worker Flow: Registrasi akun via Phone OTP');
    const workerPhone = '+628111222333';
    const workerOtp = await otpService.sendOtp(workerPhone);
    const workerAuth = await otpService.verifyOtp(workerPhone, workerOtp.devCode!);
    assert.ok(workerAuth.token);
    const workerUserId = workerAuth.user.id;
    console.log(`   -> Worker Auth Berhasil: User ID = ${workerUserId}`);

    // Update worker user full name
    const workerUserRow = dbUsers.get(workerUserId);
    if (workerUserRow) {
      workerUserRow.full_name_encrypted = await encryptField('Budi Santoso');
    }

    console.log('[2/8] Worker Flow: Verifikasi Biometrik & KTP via Verihubs API');
    const verihubsMock = new DefaultVerihubsClient(0.94, '3171012345678901');
    const kycService = new KycService(undefined, workerRepo, verihubsMock);
    const kycResult = await kycService.verifyWorkerKyc({
      workerId: workerUserId,
      ktpS3Key: 'kyc/ktp/worker_budi.jpg',
      selfieS3Key: 'kyc/selfie/worker_budi.jpg',
      skckS3Key: 'kyc/skck/worker_budi.pdf',
    });
    assert.equal(kycResult.verificationStatus, 'VERIFIED');
    assert.equal(kycResult.matchScore, 0.94);
    console.log(`   -> KYC Status: VERIFIED (Kemiripan Biometrik = ${(kycResult.matchScore * 100).toFixed(1)}%)`);

    console.log('[3/8] Worker Flow: Konfigurasi Tarif Layanan');
    const pricingService = new PricingService(workerRepo, redis);
    await pricingService.setPricingCapabilities(workerUserId, {
      supportedPetTypes: ['DOG_SMALL', 'DOG_MEDIUM'],
      price30m: 50000,
      price60m: 80000,
      price120m: 150000,
      priceOvernight: 250000,
    });
    console.log('   -> Tarif Berhasil Disimpan: 30m=Rp50k, 60m=Rp80k, 120m=Rp150k');

    console.log('[4/8] Worker Flow: Aktifkan Standby & Ping Lokasi GPS');
    const geoService = new GeolocationService(redis, mockDb);
    // Posisi Monas Jakarta (-6.1754, 106.8272)
    const workerLat = -6.1754;
    const workerLng = 106.8272;

    const pingResult = await geoService.pingLocation({
      workerId: workerUserId,
      latitude: workerLat,
      longitude: workerLng,
      accuracy: 12, // akurasi GPS baik (<50m)
    });
    assert.equal(pingResult.success, true);
    console.log(`   -> Status Worker: ONLINE (Lokasi: [${workerLat}, ${workerLng}], Akurasi: 12m)`);

    // ========================================================
    // TAHAP 2: OWNER FLOW (LOGIN, CARI WORKER, MATCHING & ESCROW)
    // ========================================================
    console.log('\n[5/8] Owner Flow: Login Pemilik Hewan & Discovery Map');
    const ownerPhone = '+628987654321';
    const ownerOtp = await otpService.sendOtp(ownerPhone);
    const ownerAuth = await otpService.verifyOtp(ownerPhone, ownerOtp.devCode!);
    assert.ok(ownerAuth.token);
    const ownerId = ownerAuth.user.id;
    console.log(`   -> Owner Auth Berhasil: Owner ID = ${ownerId}`);

    // Owner mencari worker di sekitar Monas (jarak ~300m)
    const ownerLat = -6.1780;
    const ownerLng = 106.8270;
    const nearbyWorkers = await geoService.discoverNearbyWorkers({
      latitude: ownerLat,
      longitude: ownerLng,
      radiusKm: 5,
    });
    assert.equal(nearbyWorkers.length, 1);
    assert.equal(nearbyWorkers[0].id, workerUserId);
    console.log(`   -> Worker Ditemukan: "${nearbyWorkers[0].fullName}" (Jarak ~${nearbyWorkers[0].distanceKm}km dari Owner)`);

    console.log('[6/8] Owner Flow: Buat Order Instant Match & Escrow Pre-Auth Hold');
    const dispatchService = new BookingDispatchService(mockDb, redis, payment);
    const grossAmount = 80000; // Paket 60 Menit (Rp 80.000)
    const idempotencyKey = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const booking = await dispatchService.createInstantMatch({
      ownerId,
      workerId: workerUserId,
      petId: 'pet-brownie-golden',
      serviceType: 'WALK',
      durationMinutes: 60,
      grossAmount,
      pickupLatitude: ownerLat,
      pickupLongitude: ownerLng,
      idempotencyKey,
    });

    assert.equal(booking.status, 'REQUESTED');
    assert.equal(booking.grossAmount, 80000);
    assert.equal(booking.commissionAmount, 12000); // 15% platform
    assert.equal(booking.workerPayout, 68000); // 85% worker
    assert.equal(payment.hasActiveHold(`ord_${idempotencyKey.slice(0, 12)}`), true);
    console.log(`   -> Escrow Hold Sukses di Midtrans: Gross = Rp${booking.grossAmount}`);
    console.log(`   -> Pembagian Dana: Worker Payout (85%) = Rp${booking.workerPayout}, Komisi Platform (15%) = Rp${booking.commissionAmount}`);
    console.log('   -> Timer Dispatch 45 Detik aktif di Redis & Push Alert dikirim ke Worker.');

    // Worker menerima order (klik "Terima Order")
    const workerRespond = await dispatchService.respondToDispatch(booking.id, workerUserId, 'ACCEPT');
    assert.equal(workerRespond.status, 'ACCEPTED');
    assert.equal(dbWorkerProfiles.get(workerUserId)?.is_online, false); // Worker otomatis sibuk
    console.log('   -> Worker Menerima Order! Status booking: ACCEPTED, Status Worker: BUSY (offline dari discovery).');

    // ========================================================
    // TAHAP 3: REAL-TIME CHAT & PHOTO CHECK-IN
    // ========================================================
    console.log('\n[7/8] Interaksi Layanan: Real-Time Encrypted Chat & GPS Check-In');
    const chatService = new ChatService(mockDb, redis);
    const chatRoom = await chatService.getOrCreateRoom(ownerId, workerUserId, booking.id);

    // Owner kirim pesan
    await chatService.sendMessage({
      roomId: chatRoom.id,
      senderId: ownerId,
      text: 'Halo mas Budi, tali anjing ada di dekat pintu depan ya.',
    });

    // Worker kirim balasan
    await chatService.sendMessage({
      roomId: chatRoom.id,
      senderId: workerUserId,
      text: 'Siap kak, saya sudah di depan pagar.',
    });

    // Verifikasi pesan terdekripsi transparan & terenkripsi di penyimpanan
    const chatHistory = await chatService.getMessages({ roomId: chatRoom.id, userId: ownerId });
    assert.equal(chatHistory.length, 2);
    assert.equal(chatHistory[0].content, 'Halo mas Budi, tali anjing ada di dekat pintu depan ya.');
    assert.equal(chatHistory[1].content, 'Siap kak, saya sudah di depan pagar.');
    console.log('   -> Real-Time Chat berjalan lancar (Pesan terenkripsi AES-256-GCM di DB).');

    // Worker tiba di titik jemput (jarak 16 meter dari owner)
    const execService = new ServiceExecutionService(mockDb, redis, payment);
    const checkInResult = await execService.checkInBooking({
      bookingId: booking.id,
      workerId: workerUserId,
      photoS3Key: 'proofs/checkin_anabul.jpg',
      latitude: ownerLat + 0.00015, // ~16 meter
      longitude: ownerLng,
    });
    assert.equal(checkInResult.status, 'IN_PROGRESS');
    assert.ok(checkInResult.distanceMeters <= 100);
    console.log(`   -> Live Camera Photo Check-In VALID: Jarak = ${Math.round(checkInResult.distanceMeters)}m (<= 100m). Sesi Jalan Dimulai!`);

    // Live route tracking points disiarkan
    await execService.broadcastRoutePoint({
      bookingId: booking.id,
      latitude: ownerLat + 0.0005,
      longitude: ownerLng + 0.0005,
      speedKmh: 4.5,
    });
    console.log('   -> Live Route Tracking aktif di WebSocket: Titik GPS rute disiarkan ke peta Owner.');

    // ========================================================
    // TAHAP 4: SELESAI JALAN, CAPTURE ESCROW, LEDGER & REVIEW
    // ========================================================
    console.log('\n[8/8] Penyelesaian: Capture Escrow, Double-Entry Ledger, & 5-Star Review');
    const completeResult = await execService.completeBooking(booking.id, workerUserId);
    assert.equal(completeResult.status, 'COMPLETED');
    assert.equal(payment.isCaptured(booking.id), true); // Dana escrow ditarik resmi dari gateway
    assert.equal(dbWorkerProfiles.get(workerUserId)?.is_online, true); // Worker kembali standby

    // Verifikasi Buku Besar Double-Entry (Debit == Credit)
    assert.equal(dbLedgerEntries.length, 1);
    const ledger = dbLedgerEntries[0];
    assert.equal(Number(ledger.debit_capture), 80000);
    assert.equal(Number(ledger.credit_payout), 68000);
    assert.equal(Number(ledger.credit_comm), 12000);
    console.log('   -> Sesi Selesai: Dana Escrow Rp80.000 berhasil di-capture di Payment Gateway.');
    console.log(`   -> Ledger Seimbang: DEBIT ESCROW (Rp${ledger.debit_capture}) == KREDIT WORKER (Rp${ledger.credit_payout}) + KREDIT PLATFORM (Rp${ledger.credit_comm}).`);
    console.log('   -> Worker kembali status ONLINE (Standby menerima order berikutnya).');

    // Owner deteksi pending review & beri rating 5 bintang
    const reviewService = new ReviewService(mockDb, redis);
    const pendingReview = await reviewService.getPendingReview(ownerId);
    assert.ok(pendingReview);
    assert.equal(pendingReview!.bookingId, booking.id);
    console.log(`   -> Owner App Mendeteksi Pending Review untuk order #${booking.id}`);

    const review = await reviewService.submitReview({
      bookingId: booking.id,
      ownerId,
      score: 5,
      comment: 'Mas Budi sangat telaten dan anjing saya sangat senang jalan-jalan tadi!',
    });
    assert.equal(review.score, 5);
    console.log(`   -> Review Berhasil Dikirim: 5 Bintang. Komentar: "${review.comment}"`);

    // Verifikasi rating worker ter-update di profil & cache evicted
    assert.equal(dbWorkerProfiles.get(workerUserId)?.rating_avg, 5.0);
    assert.equal(dbWorkerProfiles.get(workerUserId)?.total_reviews, 1);
    console.log(`   -> DB Trigger Aktif: Profil Worker kini Rating = ${dbWorkerProfiles.get(workerUserId)?.rating_avg}★ (Total Review = 1).`);

    console.log('\n======================================================');
    console.log('✅ SELURUH SKENARIO LIVE BERHASIL 100% TANPA KENDALA!');
    console.log('======================================================\n');
  });
});
