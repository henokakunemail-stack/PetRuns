import { DatabaseClient, dbClient } from '../db/client.ts';
import { encryptField, decryptField } from '../security/encryption.ts';

export interface WorkerProfileRow {
  id: string;
  bio: string | null;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  ktp_encrypted: string;
  ktp_s3_key: string;
  selfie_s3_key: string;
  skck_s3_key: string;
  supported_pet_types: string[];
  price_30m: string | number;
  price_60m: string | number;
  price_120m: string | number;
  price_overnight: string | number;
  rating_avg: string | number;
  rating_count: number;
  is_online: boolean;
  current_location?: unknown;
  last_location_at: Date | null;
}

export interface WorkerProfile {
  id: string;
  bio: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  ktpNumber: string;
  ktpS3Key: string;
  selfieS3Key: string;
  skckS3Key: string;
  supportedPetTypes: string[];
  price30m: number;
  price60m: number;
  price120m: number;
  priceOvernight: number;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  lastLocationAt: Date | null;
}

export interface UpsertWorkerProfileData {
  id: string;
  bio?: string | null;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  ktpNumber?: string;
  ktpS3Key?: string;
  selfieS3Key?: string;
  skckS3Key?: string;
  supportedPetTypes?: string[];
  price30m?: number;
  price60m?: number;
  price120m?: number;
  priceOvernight?: number;
  isOnline?: boolean;
}

export class WorkerProfileRepository {
  private db: DatabaseClient;

  constructor(db: DatabaseClient = dbClient) {
    this.db = db;
  }

  private async toDomain(row: WorkerProfileRow): Promise<WorkerProfile> {
    const ktpNumber = row.ktp_encrypted ? await decryptField(row.ktp_encrypted) : '';

    return {
      id: row.id,
      bio: row.bio,
      verificationStatus: row.verification_status,
      ktpNumber,
      ktpS3Key: row.ktp_s3_key,
      selfieS3Key: row.selfie_s3_key,
      skckS3Key: row.skck_s3_key,
      supportedPetTypes: row.supported_pet_types || [],
      price30m: Number(row.price_30m || 0),
      price60m: Number(row.price_60m || 0),
      price120m: Number(row.price_120m || 0),
      priceOvernight: Number(row.price_overnight || 0),
      ratingAvg: Number(row.rating_avg || 5.0),
      ratingCount: Number(row.rating_count || 0),
      isOnline: Boolean(row.is_online),
      lastLocationAt: row.last_location_at,
    };
  }

  async upsert(data: UpsertWorkerProfileData): Promise<WorkerProfile> {
    const ktpEncrypted = data.ktpNumber ? await encryptField(data.ktpNumber) : null;

    const query = `
      INSERT INTO worker_profiles (
        id, bio, verification_status, ktp_encrypted, ktp_s3_key, selfie_s3_key, skck_s3_key,
        supported_pet_types, price_30m, price_60m, price_120m, price_overnight, is_online
      )
      VALUES (
        $1, $2, COALESCE($3, 'PENDING'), COALESCE($4, ''), COALESCE($5, ''), COALESCE($6, ''), COALESCE($7, ''),
        COALESCE($8, ARRAY[]::TEXT[]), COALESCE($9, 0), COALESCE($10, 0), COALESCE($11, 0), COALESCE($12, 0),
        COALESCE($13, FALSE)
      )
      ON CONFLICT (id) DO UPDATE SET
        bio = COALESCE(EXCLUDED.bio, worker_profiles.bio),
        verification_status = CASE WHEN $3 IS NOT NULL THEN EXCLUDED.verification_status ELSE worker_profiles.verification_status END,
        ktp_encrypted = CASE WHEN $4 IS NOT NULL THEN EXCLUDED.ktp_encrypted ELSE worker_profiles.ktp_encrypted END,
        ktp_s3_key = CASE WHEN $5 IS NOT NULL THEN EXCLUDED.ktp_s3_key ELSE worker_profiles.ktp_s3_key END,
        selfie_s3_key = CASE WHEN $6 IS NOT NULL THEN EXCLUDED.selfie_s3_key ELSE worker_profiles.selfie_s3_key END,
        skck_s3_key = CASE WHEN $7 IS NOT NULL THEN EXCLUDED.skck_s3_key ELSE worker_profiles.skck_s3_key END,
        supported_pet_types = CASE WHEN $8 IS NOT NULL THEN EXCLUDED.supported_pet_types ELSE worker_profiles.supported_pet_types END,
        price_30m = CASE WHEN $9 IS NOT NULL THEN EXCLUDED.price_30m ELSE worker_profiles.price_30m END,
        price_60m = CASE WHEN $10 IS NOT NULL THEN EXCLUDED.price_60m ELSE worker_profiles.price_60m END,
        price_120m = CASE WHEN $11 IS NOT NULL THEN EXCLUDED.price_120m ELSE worker_profiles.price_120m END,
        price_overnight = CASE WHEN $12 IS NOT NULL THEN EXCLUDED.price_overnight ELSE worker_profiles.price_overnight END,
        is_online = CASE WHEN $13 IS NOT NULL THEN EXCLUDED.is_online ELSE worker_profiles.is_online END
      RETURNING *;
    `;

    const result = await this.db.query<WorkerProfileRow>(query, [
      data.id,
      data.bio ?? null,
      data.verificationStatus ?? null,
      ktpEncrypted,
      data.ktpS3Key ?? null,
      data.selfieS3Key ?? null,
      data.skckS3Key ?? null,
      data.supportedPetTypes ?? null,
      data.price30m ?? null,
      data.price60m ?? null,
      data.price120m ?? null,
      data.priceOvernight ?? null,
      data.isOnline ?? null,
    ]);

    return this.toDomain(result.rows[0]);
  }

  async findById(id: string): Promise<WorkerProfile | null> {
    const query = `
      SELECT *
      FROM worker_profiles
      WHERE id = $1;
    `;

    const result = await this.db.query<WorkerProfileRow>(query, [id]);
    if (!result.rows.length) return null;
    return this.toDomain(result.rows[0]);
  }
}

export const workerProfileRepository = new WorkerProfileRepository();
