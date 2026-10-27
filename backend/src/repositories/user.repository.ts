import { DatabaseClient, dbClient } from '../db/client.ts';
import { encryptField, decryptField, hashPhone } from '../security/encryption.ts';

export interface UserRow {
  [column: string]: unknown;
  id: string;
  phone_encrypted: string;
  phone_hash: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
  full_name_encrypted: string;
  deleted_at: Date | null;
  created_at: Date;
}

export interface User {
  id: string;
  phone: string;
  phoneHash: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
  fullName: string;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface CreateUserData {
  id?: string;
  phone: string;
  fullName: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
}

export class UserRepository {
  private db: DatabaseClient;

  constructor(db: DatabaseClient = dbClient) {
    this.db = db;
  }

  private async toDomain(row: UserRow): Promise<User> {
    const [phone, fullName] = await Promise.all([
      decryptField(row.phone_encrypted),
      decryptField(row.full_name_encrypted),
    ]);

    return {
      id: row.id,
      phone,
      phoneHash: row.phone_hash,
      role: row.role,
      fullName,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
    };
  }

  async create(data: CreateUserData): Promise<User> {
    const phoneHash = hashPhone(data.phone);
    const [phoneEncrypted, fullNameEncrypted] = await Promise.all([
      encryptField(data.phone),
      encryptField(data.fullName),
    ]);

    const query = `
      INSERT INTO users (id, phone_encrypted, phone_hash, role, full_name_encrypted)
      VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5)
      RETURNING id, phone_encrypted, phone_hash, role, full_name_encrypted, deleted_at, created_at;
    `;

    // Zero plaintext PII in logs: log only safe non-PII fields like phone_hash prefix
    // console.log(`[UserRepository] inserting user with hash ${phoneHash.slice(0, 8)}...`);

    const result = await this.db.query<UserRow>(query, [
      data.id || null,
      phoneEncrypted,
      phoneHash,
      data.role,
      fullNameEncrypted,
    ]);

    return this.toDomain(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, phone_encrypted, phone_hash, role, full_name_encrypted, deleted_at, created_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL;
    `;

    const result = await this.db.query<UserRow>(query, [id]);
    if (!result.rows.length) return null;
    return this.toDomain(result.rows[0]);
  }

  async findByPhone(phone: string): Promise<User | null> {
    const phoneHash = hashPhone(phone);
    return this.findByPhoneHash(phoneHash);
  }

  async findByPhoneHash(phoneHash: string): Promise<User | null> {
    const query = `
      SELECT id, phone_encrypted, phone_hash, role, full_name_encrypted, deleted_at, created_at
      FROM users
      WHERE phone_hash = $1 AND deleted_at IS NULL;
    `;

    const result = await this.db.query<UserRow>(query, [phoneHash]);
    if (!result.rows.length) return null;
    return this.toDomain(result.rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    const anonymizedPhoneEncrypted = await encryptField('+620000000000');
    const anonymizedNameEncrypted = await encryptField('Anonymized User');

    const query = `
      UPDATE users
      SET deleted_at = NOW(),
          phone_encrypted = $2,
          full_name_encrypted = $3
      WHERE id = $1;
    `;

    await this.db.query(query, [id, anonymizedPhoneEncrypted, anonymizedNameEncrypted]);
  }
}

export const userRepository = new UserRepository();
