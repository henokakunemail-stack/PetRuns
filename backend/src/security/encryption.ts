import crypto from 'crypto';
import { kmsClient } from './kms-client.ts';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits auth tag
const DEFAULT_SALT = process.env.PHONE_HASH_SALT || 'petmatch-static-salt-jakarta-v1';

export interface SerializedEncryptedField {
  ivHex: string;
  tagHex: string;
  cipherHex: string;
}

/**
 * Encrypt plaintext string using AES-256-GCM.
 * Packed format: `${ivHex}:${tagHex}:${cipherHex}`
 */
export async function encryptField(
  plaintext: string,
  dekOverride?: Buffer
): Promise<string> {
  if (!plaintext) return plaintext;
  const key = dekOverride || (await kmsClient.getDataEncryptionKey());
  if (key.length !== 32) {
    throw new Error(`Invalid DEK length for AES-256: expected 32 bytes, got ${key.length}`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt serialized AES-256-GCM string.
 * Validates auth tag and throws on tampering or corruption.
 */
export async function decryptField(
  serialized: string,
  dekOverride?: Buffer
): Promise<string> {
  if (!serialized) return serialized;
  const parts = serialized.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format. Expected iv:tag:ciphertext');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes`);
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${TAG_LENGTH} bytes`);
  }

  const key = dekOverride || (await kmsClient.getDataEncryptionKey());
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Decryption failed: auth tag verification error (data tampered or wrong key)');
  }
}

/**
 * Normalizes phone number (E.164 formatting or digits only) and computes deterministic SHA-256 blind index.
 */
export function hashPhone(phone: string, salt: string = DEFAULT_SALT): string {
  if (!phone) return '';
  // Normalize: remove all non-digits except leading +
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  const normalized = cleaned.startsWith('0')
    ? '+62' + cleaned.slice(1)
    : cleaned.startsWith('62')
      ? '+' + cleaned
      : cleaned;

  return crypto
    .createHmac('sha256', salt)
    .update(normalized)
    .digest('hex');
}
