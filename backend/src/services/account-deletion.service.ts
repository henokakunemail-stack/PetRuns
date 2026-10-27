import crypto from 'crypto';
import { dbClient, DatabaseClient } from '../db/client.ts';
import { jwtService, JwtService } from '../security/jwt-service.ts';
import { encryptField } from '../security/encryption.ts';
import { HttpError } from './otp.service.ts';

export interface DeleteAccountOptions {
  userId: string;
  confirmDeletion: boolean;
  jti?: string;
  tokenExpiresInSeconds?: number;
}

export interface DeleteAccountResult {
  success: boolean;
  message: string;
  deletedAt: Date;
}

export class AccountDeletionService {
  private db: DatabaseClient;
  private jwt: JwtService;

  constructor(db: DatabaseClient = dbClient, jwt: JwtService = jwtService) {
    this.db = db;
    this.jwt = jwt;
  }

  async deleteAccount(options: DeleteAccountOptions): Promise<DeleteAccountResult> {
    const { userId, confirmDeletion, jti, tokenExpiresInSeconds } = options;

    if (!confirmDeletion) {
      throw new HttpError(
        'Account deletion requires explicit confirmation payload: { confirmDeletion: true }',
        400
      );
    }

    if (!userId) {
      throw new HttpError('User ID is required', 400);
    }

    // 1. Scrub PII values with tombstone ciphertext
    const tombstoneCiphertext = await encryptField('[ACCOUNT_DELETED]');
    const scrambledPhoneHash = crypto.randomBytes(32).toString('hex');
    const now = new Date();

    // 2. Transactionally update users and worker_profiles
    await this.db.transaction(async (client) => {
      // Scrub users table
      await client.query(
        `UPDATE users
         SET full_name_encrypted = $1,
             phone_encrypted = $1,
             phone_hash = $2,
             deleted_at = $3
         WHERE id = $4`,
        [tombstoneCiphertext, scrambledPhoneHash, now, userId]
      );

      // Scrub worker_profiles if exists
      await client.query(
        `UPDATE worker_profiles
         SET bio = '[ACCOUNT_DELETED]',
             ktp_encrypted = $1,
             ktp_s3_key = null,
             selfie_s3_key = null,
             skck_s3_key = null,
             is_online = false,
             verification_status = 'REJECTED'
         WHERE id = $2`,
        [tombstoneCiphertext, userId]
      );
    });

    // 3. Immediately revoke active JWT via Redis blocklist
    if (jti) {
      await this.jwt.revoke(jti, tokenExpiresInSeconds ?? 900);
    }

    return {
      success: true,
      message: 'Account successfully deleted and PII scrubbed in compliance with Apple Guideline 5.1.1(v)',
      deletedAt: now,
    };
  }
}

export const accountDeletionService = new AccountDeletionService();
