import fs from 'fs';
import path from 'path';
import { kmsClient } from '../src/security/kms-client';
import { encryptField, decryptField, hashPhone } from '../src/security/encryption';
import { s3StorageService } from '../src/storage/s3-client';
import { presignedUrlService, ALLOWED_UPLOAD_PREFIXES, ALLOWED_MIME_TYPES } from '../src/storage/presigned-url.service';
import { UserRepository, UserRow } from '../src/repositories/user.repository';
import { DatabaseClient } from '../src/db/client';
import type { QueryResult } from 'pg';

describe('Phase 1: Core Data Schema and Security Foundation', () => {
  describe('Task 1: PostGIS Schema & Spatial Indexes', () => {
    it('migration file defines all required tables and GIST spatial indexes', () => {
      const migrationPath = path.resolve(__dirname, '../migrations/001_init_postgis_and_schema.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // PostGIS extension
      expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "postgis"');
      expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

      // Required tables
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS worker_profiles');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS pets');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS bookings');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS service_proofs');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS reviews');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS ledger_entries');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS route_points');

      // Spatial GIST indexes
      expect(sql).toContain('idx_worker_profiles_current_location_gist');
      expect(sql).toContain('USING GIST(current_location)');
      expect(sql).toContain('idx_service_proofs_captured_location_gist');
      expect(sql).toContain('USING GIST(captured_location)');
      expect(sql).toContain('USING GIST(pickup_location)');
      expect(sql).toContain('phone_hash VARCHAR(64) UNIQUE NOT NULL');
    });
  });

  describe('Task 2: PgBouncer Pooling & Connection Client', () => {
    it('pgbouncer.ini specifies transaction mode and caps pool connections at 50', () => {
      const iniPath = path.resolve(__dirname, '../src/config/pgbouncer.ini');
      expect(fs.existsSync(iniPath)).toBe(true);
      const content = fs.readFileSync(iniPath, 'utf8');
      expect(content).toContain('pool_mode = transaction');
      expect(content).toContain('default_pool_size = 50');
      expect(content).toContain('max_db_connections = 50');
    });

    it('client initializes with max 50 connections and executes verifyConnection', async () => {
      const client = new DatabaseClient({ max: 50 });
      expect(client.getPool().options.max).toBe(50);
      // Mock pool query for SELECT 1
      jest.spyOn(client.getPool(), 'query').mockImplementation(async (text: unknown) => {
        if (text === 'SELECT 1 as healthy') {
          return { rows: [{ healthy: 1 }] } as unknown as QueryResult;
        }
        return { rows: [] } as unknown as QueryResult;
      });

      const isHealthy = await client.verifyConnection();
      expect(isHealthy).toBe(true);
      await client.drain();
    });
  });

  describe('Task 3: KMS Key Retrieval & Memory Cache', () => {
    it('caches plaintext DEK in memory within 1-hour TTL', async () => {
      kmsClient.clearCache();
      const initialCount = kmsClient.networkCallCount;

      const key1 = await kmsClient.getDataEncryptionKey();
      expect(key1).toBeInstanceOf(Buffer);
      expect(key1.length).toBe(32);
      expect(kmsClient.networkCallCount).toBe(initialCount + 1);

      // Subsequent call should hit in-memory cache
      const key2 = await kmsClient.getDataEncryptionKey();
      expect(key2).toEqual(key1);
      expect(kmsClient.networkCallCount).toBe(initialCount + 1);
    });
  });

  describe('Task 4: AES-256-GCM Encryption and Blind Index', () => {
    it('encrypting same text twice generates different ciphertexts and IVs', async () => {
      const plain = '+6281234567890';
      const enc1 = await encryptField(plain);
      const enc2 = await encryptField(plain);

      expect(enc1).not.toEqual(enc2);
      const [iv1] = enc1.split(':');
      const [iv2] = enc2.split(':');
      expect(iv1).not.toEqual(iv2);

      expect(await decryptField(enc1)).toBe(plain);
      expect(await decryptField(enc2)).toBe(plain);
    });

    it('tampered ciphertext or auth tag fails decryption', async () => {
      const enc = await encryptField('secret payload');
      const [iv, tag, cipher] = enc.split(':');
      // Tamper ciphertext
      const tamperedCipher = cipher.slice(0, -2) + (cipher.slice(-2) === 'aa' ? 'bb' : 'aa');
      const tampered = `${iv}:${tag}:${tamperedCipher}`;

      await expect(decryptField(tampered)).rejects.toThrow('Decryption failed');
    });

    it('phone hash produces deterministic SHA-256 hex string', () => {
      const hash1 = hashPhone('+6281234567890');
      const hash2 = hashPhone('0812-3456-7890');
      const hash3 = hashPhone('6281234567890');

      expect(hash1.length).toBe(64);
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });
  });

  describe('Task 5: Repository PII Encryption Hooks', () => {
    it('encrypts phone and legal name before DB insert, transparently decrypts on read', async () => {
      let insertedRow: UserRow | null = null;

      const mockDb = {
        query: jest.fn().mockImplementation(async (queryText: string, params: unknown[]) => {
          if (queryText.includes('INSERT INTO users')) {
            insertedRow = {
              id: (params[0] as string) || 'mock-user-uuid',
              phone_encrypted: params[1] as string,
              phone_hash: params[2] as string,
              role: params[3] as 'OWNER' | 'WORKER' | 'ADMIN',
              full_name_encrypted: params[4] as string,
              deleted_at: null,
              created_at: new Date(),
            };
            return { rows: [insertedRow] };
          }
          if (queryText.includes('WHERE phone_hash = $1')) {
            return { rows: insertedRow ? [insertedRow] : [] };
          }
          return { rows: [] };
        }),
      } as unknown as DatabaseClient;

      const repo = new UserRepository(mockDb);
      const user = await repo.create({
        phone: '+6281299998888',
        fullName: 'Budi Santoso',
        role: 'OWNER',
      });

      expect(user.phone).toBe('+6281299998888');
      expect(user.fullName).toBe('Budi Santoso');
      // Verify raw row in DB contains only ciphertext
      expect(insertedRow!.phone_encrypted).not.toContain('81299998888');
      expect(insertedRow!.full_name_encrypted).not.toContain('Budi');

      // Query by phone
      const found = await repo.findByPhone('+6281299998888');
      expect(found).not.toBeNull();
      expect(found!.fullName).toBe('Budi Santoso');
    });
  });

  describe('Task 6: S3 SSE-KMS Enforcement', () => {
    it('enforces SSE-KMS header and rejects non-KMS uploads', async () => {
      const res = await s3StorageService.putObject({
        key: 'proofs/booking-1/start.jpg',
        body: Buffer.from('image-bytes'),
        contentType: 'image/jpeg',
      });

      expect(res.serverSideEncryption).toBe('aws:kms');
      expect(res.kmsKeyId).toBeTruthy();

      await expect(
        s3StorageService.putObject({
          key: 'proofs/test.jpg',
          body: Buffer.from('test'),
          contentType: 'image/jpeg',
          serverSideEncryption: 'AES256' as unknown as 'aws:kms',
        })
      ).rejects.toThrow('Forbidden: All S3 uploads must enforce SSE-KMS');
    });

    it('generates bucket policy blocking public access and unencrypted uploads', () => {
      const policy = s3StorageService.generateSecurityBucketPolicy();
      expect(JSON.stringify(policy)).toContain('DenyUnEncryptedObjectUploads');
      expect(JSON.stringify(policy)).toContain('DenyPublicAccessACLs');
      expect(JSON.stringify(policy)).toContain('EnforceTLS13AndHTTPSOnly');
    });
  });

  describe('Task 7: Presigned URL Service', () => {
    it('generates 300s TTL presigned PUT URL for valid prefixes and MIME types', () => {
      const res = presignedUrlService.generateUrl({
        operation: 'PUT',
        key: 'kyc/ktp/worker-123.jpg',
        contentType: 'image/jpeg',
      });

      expect(res.url).toContain('kyc/ktp/worker-123.jpg');
      expect(res.url).toContain('X-Amz-Expires=300');
      expect(res.headers['x-amz-server-side-encryption']).toBe('aws:kms');
    });

    it('rejects disallowed path prefix or MIME type', () => {
      expect(() => {
        presignedUrlService.generateUrl({
          operation: 'PUT',
          key: 'malicious/path.exe',
          contentType: 'image/jpeg',
        });
      }).toThrow('Disallowed upload key path');

      expect(() => {
        presignedUrlService.generateUrl({
          operation: 'PUT',
          key: 'kyc/ktp/file.exe',
          contentType: 'application/x-msdownload',
        });
      }).toThrow('Disallowed MIME type');
    });
  });
});
