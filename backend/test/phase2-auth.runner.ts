import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OtpService, HttpError } from '../src/services/otp.service.ts';
import { InMemoryRedisClient } from '../src/redis/redis-client.ts';
import { UserRepository, type UserRow } from '../src/repositories/user.repository.ts';
import { DatabaseClient } from '../src/db/client.ts';
import { JwtService } from '../src/security/jwt-service.ts';
import { KycService, DefaultVerihubsClient } from '../src/services/kyc.service.ts';
import { WorkerProfileRepository } from '../src/repositories/worker-profile.repository.ts';
import { PricingService } from '../src/services/pricing.service.ts';
import { AccountDeletionService } from '../src/services/account-deletion.service.ts';

describe('Phase 2: Authentication and Worker Verification', () => {
  it('Task 8: OTP rate limit caps at 3 requests per 10 minutes (returns 429)', async () => {
    const redis = new InMemoryRedisClient();
    const mockDb = new DatabaseClient({
      mockQueryHandler: async () => [],
    });
    const userRepo = new UserRepository(mockDb);
    const jwt = new JwtService('test-secret', redis);
    const otp = new OtpService(redis, userRepo, jwt);

    const phone = '+6281233334444';

    // First 3 requests must succeed
    const res1 = await otp.sendOtp(phone);
    assert.equal(res1.success, true);
    const res2 = await otp.sendOtp(phone);
    assert.equal(res2.success, true);
    const res3 = await otp.sendOtp(phone);
    assert.equal(res3.success, true);

    // 4th request must be rejected with 429
    await assert.rejects(
      async () => {
        await otp.sendOtp(phone);
      },
      (err: unknown) => {
        return err instanceof HttpError && err.statusCode === 429;
      }
    );
  });

  it('Task 8: OTP verification creates OWNER record and issues valid JWT', async () => {
    const redis = new InMemoryRedisClient();
    let createdUserRow: UserRow | null = null;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('WHERE phone_hash = $1')) {
          return createdUserRow ? [createdUserRow] : [];
        }
        if (queryText.includes('INSERT INTO users')) {
          createdUserRow = {
            id: 'owner-uuid-42',
            phone_encrypted: String(p[1] ?? ''),
            phone_hash: String(p[2] ?? ''),
            role: 'OWNER',
            full_name_encrypted: String(p[4] ?? ''),
            deleted_at: null,
            created_at: new Date(),
          };
          return [createdUserRow];
        }
        return [];
      },
    });

    const userRepo = new UserRepository(mockDb);
    const jwt = new JwtService('test-secret', redis);
    const otp = new OtpService(redis, userRepo, jwt);

    const phone = '+6281255556666';
    const sendRes = await otp.sendOtp(phone);
    assert.ok(sendRes.devCode);

    const verifyRes = await otp.verifyOtp(phone, sendRes.devCode);
    assert.ok(verifyRes.token);
    assert.equal(verifyRes.user.role, 'OWNER');

    // Verify token unpacks correctly
    const payload = await jwt.verify(verifyRes.token);
    assert.equal(payload.sub, 'owner-uuid-42');
    assert.equal(payload.role, 'OWNER');
  });
  it('Task 10: KYC Presigned URL generates valid 300s PUT URLs and rejects bad MIME types', () => {

    const kyc = new KycService();

    const res = kyc.generateKycUploadUrl({
      workerId: 'worker-101',
      docType: 'ktp',
      contentType: 'image/jpeg',
    });

    assert.ok(res.url.includes('kyc/ktp/worker-101.jpg'));
    assert.ok(res.url.includes('X-Amz-Expires=300'));
    assert.equal(res.operation, 'PUT');

    assert.throws(() => {
      kyc.generateKycUploadUrl({
        workerId: 'worker-101',
        docType: 'selfie',
        contentType: 'application/pdf',
      });
    }, /Selfie biometric document must be an image/);
  });

  it('Task 11: Verihubs Biometric pipeline rejects < 85% match and verifies >= 85% with encrypted KTP', async () => {


    let savedProfileRow: Record<string, unknown> | null = null;
    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('INSERT INTO worker_profiles')) {
          savedProfileRow = {
            id: String(p[0] ?? ''),
            bio: p[1] ?? null,
            verification_status: String(p[2] ?? 'PENDING'),
            ktp_encrypted: String(p[3] ?? ''),
            ktp_s3_key: String(p[4] ?? ''),
            selfie_s3_key: String(p[5] ?? ''),
            skck_s3_key: String(p[6] ?? ''),
            supported_pet_types: p[7] ?? [],
            price_30m: p[8] ?? 0,
            price_60m: p[9] ?? 0,
            price_120m: p[10] ?? 0,
            price_overnight: p[11] ?? 0,
            is_online: Boolean(p[12]),
            rating_avg: 5.0,
            rating_count: 0,
            last_location_at: null,
          };
          return [savedProfileRow];
        }
        return [];
      },
    });

    const workerRepo = new WorkerProfileRepository(mockDb);

    // 1. Biometric match score 0.72 (< 0.85) -> REJECTED
    const kycLowScore = new KycService(undefined, workerRepo, new DefaultVerihubsClient(0.72));
    const resLow = await kycLowScore.verifyWorkerKyc({
      workerId: 'worker-fail',
      ktpS3Key: 'kyc/ktp/worker-fail.jpg',
      selfieS3Key: 'kyc/selfie/worker-fail.jpg',
      skckS3Key: 'kyc/skck/worker-fail.pdf',
    });
    assert.equal(resLow.verificationStatus, 'REJECTED');
    assert.equal(savedProfileRow!.verification_status, 'REJECTED');
    assert.equal(savedProfileRow!.is_online, false);

    // 2. Biometric match score 0.94 (>= 0.85) -> VERIFIED
    const kycHighScore = new KycService(undefined, workerRepo, new DefaultVerihubsClient(0.94, '3171012345678901'));
    const resHigh = await kycHighScore.verifyWorkerKyc({
      workerId: 'worker-pass',
      ktpS3Key: 'kyc/ktp/worker-pass.jpg',
      selfieS3Key: 'kyc/selfie/worker-pass.jpg',
      skckS3Key: 'kyc/skck/worker-pass.pdf',
    });
    assert.equal(resHigh.verificationStatus, 'VERIFIED');
    assert.equal(savedProfileRow!.verification_status, 'VERIFIED');

    // Assert KTP is encrypted and plain NIK never in DB
    assert.ok(typeof savedProfileRow!.ktp_encrypted === 'string');
    assert.ok(!String(savedProfileRow!.ktp_encrypted).includes('3171012345678901'));
  });
  it('Task 13: Worker pricing rejects invalid pet types, negative prices, and invalidates Redis cache', async () => {
    const redis = new InMemoryRedisClient();
    let updatedRecord: Record<string, unknown> | null = null;
    const mockDb = new DatabaseClient({
      mockQueryHandler: async (_query: string, params?: unknown[]) => {
        const p = params ?? [];
        updatedRecord = {
          id: p[0],
          supported_pet_types: p[7],
          price_30m: p[8],
          price_60m: p[9],
          price_120m: p[10],
          price_overnight: p[11],
        };
        return [updatedRecord];
      },
    });
    const workerRepo = new WorkerProfileRepository(mockDb);
    const pricing = new PricingService(workerRepo, redis);

    // Set dummy cache
    await redis.set('cache:worker:worker-abc', 'cached-data');

    // Invalid pet type rejects
    await assert.rejects(
      async () => {
        await pricing.setPricingCapabilities('worker-abc', {
          // @ts-expect-error test invalid enum
          supportedPetTypes: ['DRAGON'],
          price30m: 35000,
          price60m: 60000,
          price120m: 110000,
          priceOvernight: 180000,
        });
      },
      (err: unknown) => err instanceof HttpError && err.statusCode === 400
    );

    // Negative price rejects
    await assert.rejects(
      async () => {
        await pricing.setPricingCapabilities('worker-abc', {
          supportedPetTypes: ['DOG_SMALL', 'CAT'],
          price30m: -100,
          price60m: 60000,
          price120m: 110000,
          priceOvernight: 180000,
        });
      },
      (err: unknown) => err instanceof HttpError && err.statusCode === 400
    );

    // Valid update updates DB and invalidates cache
    await pricing.setPricingCapabilities('worker-abc', {
      supportedPetTypes: ['DOG_SMALL', 'CAT'],
      price30m: 40000,
      price60m: 70000,
      price120m: 130000,
      priceOvernight: 200000,
    });

    assert.equal(await redis.get('cache:worker:worker-abc'), null);
    assert.equal(updatedRecord!.price_30m, 40000);
  });

  it('Task 15: Account deletion scrubs PII, sets deleted_at, and revokes JWT in Redis', async () => {
    const redis = new InMemoryRedisClient();
    const jwt = new JwtService('test-secret', redis);
    let userScrubbed = false;
    let workerScrubbed = false;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string) => {
        if (queryText.includes('UPDATE users')) {
          userScrubbed = true;
        }
        if (queryText.includes('UPDATE worker_profiles')) {
          workerScrubbed = true;
        }
        return [];
      },
    });

    const deletionService = new AccountDeletionService(mockDb, jwt);

    // Generate active JWT token
    const token = await jwt.sign({
      userId: 'user-to-delete',
      role: 'OWNER',
      phoneHash: 'sample-hash',
      expiresInSeconds: 600,
    });

    const decoded = await jwt.verify(token);
    assert.ok(decoded.jti);

    // Execute deletion with confirmation
    const res = await deletionService.deleteAccount({
      userId: 'user-to-delete',
      confirmDeletion: true,
      jti: decoded.jti,
    });

    assert.equal(res.success, true);
    assert.equal(userScrubbed, true);
    assert.equal(workerScrubbed, true);

    // JWT is revoked in Redis blocklist
    await assert.rejects(
      async () => {
        await jwt.verify(token);
      },
      /revoked/
    );
  });
});
