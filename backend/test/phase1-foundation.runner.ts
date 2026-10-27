import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { kmsClient } from '../src/security/kms-client.ts';
import { encryptField, decryptField, hashPhone } from '../src/security/encryption.ts';
import { s3StorageService } from '../src/storage/s3-client.ts';
import { presignedUrlService, ALLOWED_UPLOAD_PREFIXES, ALLOWED_MIME_TYPES } from '../src/storage/presigned-url.service.ts';
import { UserRepository, type UserRow } from '../src/repositories/user.repository.ts';
import { DatabaseClient, type QueryResult } from '../src/db/client.ts';

describe('Phase 1: Core Data Schema and Security Foundation', () => {
  it('Task 1: Migration defines PostGIS schema & GIST spatial indexes', () => {
    const migrationPath = path.resolve(__dirname, '../migrations/001_init_postgis_and_schema.sql');
    assert.equal(fs.existsSync(migrationPath), true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sql.includes('CREATE EXTENSION IF NOT EXISTS "postgis"'));
    assert.ok(sql.includes('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS users'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS worker_profiles'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS pets'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS bookings'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS service_proofs'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS reviews'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS ledger_entries'));
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS route_points'));
    assert.ok(sql.includes('idx_worker_profiles_current_location_gist'));
    assert.ok(sql.includes('USING GIST(current_location)'));
    assert.ok(sql.includes('idx_service_proofs_captured_location_gist'));
    assert.ok(sql.includes('USING GIST(captured_location)'));
    assert.ok(sql.includes('phone_hash VARCHAR(64) UNIQUE NOT NULL'));
  });

  it('Task 2: PgBouncer config specifies transaction mode & max 50 server pool connections', async () => {
    const iniPath = path.resolve(__dirname, '../src/config/pgbouncer.ini');
    assert.equal(fs.existsSync(iniPath), true);
    const content = fs.readFileSync(iniPath, 'utf8');
    assert.ok(content.includes('pool_mode = transaction'));
    assert.ok(content.includes('default_pool_size = 50'));
    assert.ok(content.includes('max_db_connections = 50'));

    const client = new DatabaseClient({
      max: 50,
      mockQueryHandler: async (q) => {
        if (q === 'SELECT 1 as healthy') {
          return [{ healthy: 1 }];
        }
        return [];
      },
    });
    assert.equal(client.getPool().options.max, 50);

    const isHealthy = await client.verifyConnection();
    assert.equal(isHealthy, true);
    await client.drain();
  });

  it('Task 3: KMS key retrieval caches in memory with 1h TTL', async () => {
    kmsClient.clearCache();
    const countBefore = kmsClient.networkCallCount;

    const key1 = await kmsClient.getDataEncryptionKey();
    assert.ok(Buffer.isBuffer(key1));
    assert.equal(key1.length, 32);
    assert.equal(kmsClient.networkCallCount, countBefore + 1);

    const key2 = await kmsClient.getDataEncryptionKey();
    assert.deepEqual(key1, key2);
    // Call count must not increment because memory cache hit
    assert.equal(kmsClient.networkCallCount, countBefore + 1);
  });

  it('Task 4: AES-256-GCM field encryption & deterministic blind index', async () => {
    const raw = '+6281234567890';
    const enc1 = await encryptField(raw);
    const enc2 = await encryptField(raw);

    assert.notEqual(enc1, enc2);
    const [iv1] = enc1.split(':');
    const [iv2] = enc2.split(':');
    assert.notEqual(iv1, iv2);

    assert.equal(await decryptField(enc1), raw);
    assert.equal(await decryptField(enc2), raw);

    // Tampered data must fail decryption
    const [iv, tag, cipher] = enc1.split(':');
    const tampered = `${iv}:${tag}:${cipher.slice(0, -2)}ff`;
    await assert.rejects(async () => {
      await decryptField(tampered);
    }, /Decryption failed/);

    // Blind index is deterministic
    const hash1 = hashPhone('+6281234567890');
    const hash2 = hashPhone('0812-3456-7890');
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
  });

  it('Task 5: Repository PII encryption hooks store ciphertext only', async () => {
    let insertedRow: UserRow | null = null;

    const mockDb = new DatabaseClient({
      mockQueryHandler: async (queryText: string, params?: unknown[]) => {
        const p = params ?? [];
        if (queryText.includes('INSERT INTO users')) {
          const rowId = typeof p[0] === 'string' && p[0] ? p[0] : 'mock-uuid-1';
          const userRole = p[3] === 'WORKER' || p[3] === 'ADMIN' ? p[3] : 'OWNER';
          insertedRow = {
            id: rowId,
            phone_encrypted: String(p[1] ?? ''),
            phone_hash: String(p[2] ?? ''),
            role: userRole,
            full_name_encrypted: String(p[4] ?? ''),
            deleted_at: null,
            created_at: new Date(),
          };
          return [insertedRow];
        }
        if (queryText.includes('WHERE phone_hash = $1')) {
          return insertedRow ? [insertedRow] : [];
        }
        return [];
      },
    });

    const repo = new UserRepository(mockDb);
    const user = await repo.create({
      phone: '+6281299998888',
      fullName: 'Budi Santoso',
      role: 'OWNER',
    });

    assert.equal(user.phone, '+6281299998888');
    assert.equal(user.fullName, 'Budi Santoso');
    assert.ok(!insertedRow!.phone_encrypted.includes('81299998888'));
    assert.ok(!insertedRow!.full_name_encrypted.includes('Budi'));

    const found = await repo.findByPhone('+6281299998888');
    assert.ok(found !== null);
    assert.equal(found?.fullName, 'Budi Santoso');
  });

  it('Task 6: AWS S3 storage client enforces SSE-KMS', async () => {
    const res = await s3StorageService.putObject({
      key: 'proofs/booking-1/start.jpg',
      body: Buffer.from('image-bytes'),
      contentType: 'image/jpeg',
    });

    assert.equal(res.serverSideEncryption, 'aws:kms');
    assert.ok(res.kmsKeyId);

    await assert.rejects(async () => {
      await s3StorageService.putObject({
        key: 'proofs/test.jpg',
        body: Buffer.from('test'),
        contentType: 'image/jpeg',
        serverSideEncryption: 'AES256' as unknown as 'aws:kms',
      });
    }, /Forbidden: All S3 uploads must enforce SSE-KMS/);
  });

  it('Task 7: Presigned URL generator validates TTL, path prefixes, and MIME types', () => {
    const res = presignedUrlService.generateUrl({
      operation: 'PUT',
      key: 'kyc/ktp/worker-123.jpg',
      contentType: 'image/jpeg',
    });

    assert.ok(res.url.includes('kyc/ktp/worker-123.jpg'));
    assert.ok(res.url.includes('X-Amz-Expires=300'));
    assert.equal(res.headers['x-amz-server-side-encryption'], 'aws:kms');

    assert.throws(() => {
      presignedUrlService.generateUrl({
        operation: 'PUT',
        key: 'invalid/path.exe',
        contentType: 'image/jpeg',
      });
    }, /Disallowed upload key path/);

    assert.throws(() => {
      presignedUrlService.generateUrl({
        operation: 'PUT',
        key: 'kyc/ktp/worker.exe',
        contentType: 'application/octet-stream',
      });
    }, /Disallowed MIME type/);
  });
});
