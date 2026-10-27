import crypto from 'crypto';
import { s3StorageService, S3StorageService } from './s3-client.ts';

export type PresignedOperation = 'PUT' | 'GET';

export const ALLOWED_UPLOAD_PREFIXES = [
  'kyc/ktp/',
  'kyc/selfie/',
  'kyc/skck/',
  'proofs/',
] as const;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_URL_EXPIRY_SECONDS = 300; // 300 seconds TTL

export interface GeneratePresignedUrlOptions {
  operation: PresignedOperation;
  key: string;
  contentType?: string;
  contentLength?: number;
  expiresInSeconds?: number;
}

export interface PresignedUrlResult {
  url: string;
  key: string;
  operation: PresignedOperation;
  expiresAt: Date;
  headers: Record<string, string>;
}

export class PresignedUrlService {
  private s3: S3StorageService;
  private signingSecret: string;

  constructor(s3: S3StorageService = s3StorageService, signingSecret?: string) {
    this.s3 = s3;
    this.signingSecret =
      signingSecret ||
      process.env.S3_PRESIGN_SECRET ||
      'petmatch-secure-presigned-url-secret-2026';
  }

  generateUrl(options: GeneratePresignedUrlOptions): PresignedUrlResult {
    const { operation, key, contentType, contentLength, expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS } = options;

    if (expiresInSeconds <= 0 || expiresInSeconds > 300) {
      throw new Error('Presigned URL expiration cannot exceed 300 seconds');
    }

    if (operation === 'PUT') {
      // Validate upload path prefix
      const isAllowedPrefix = ALLOWED_UPLOAD_PREFIXES.some((prefix) => key.startsWith(prefix));
      if (!isAllowedPrefix) {
        throw new Error(
          `Disallowed upload key path: "${key}". Allowed prefixes: ${ALLOWED_UPLOAD_PREFIXES.join(', ')}`
        );
      }

      // Validate MIME type
      if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType as (typeof ALLOWED_MIME_TYPES)[number])) {
        throw new Error(
          `Disallowed MIME type: "${contentType}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
        );
      }

      // Validate size limit
      if (contentLength && contentLength > MAX_UPLOAD_SIZE_BYTES) {
        throw new Error(
          `Upload file size exceeds maximum limit of 5 MB (${MAX_UPLOAD_SIZE_BYTES} bytes)`
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresEpoch = now + expiresInSeconds;
    const expiresAt = new Date(expiresEpoch * 1000);

    const headers: Record<string, string> = {};
    if (operation === 'PUT') {
      if (contentType) headers['Content-Type'] = contentType;
      headers['x-amz-server-side-encryption'] = 'aws:kms';
      headers['x-amz-server-side-encryption-aws-kms-key-id'] = this.s3.kmsKeyId;
    }

    // Build HMAC-SHA256 signature for URL validation
    const stringToSign = `${operation}\n${this.s3.bucket}\n${key}\n${expiresEpoch}\n${contentType || ''}`;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(stringToSign)
      .digest('hex');

    const host = this.s3.endpoint || `https://${this.s3.bucket}.s3.${this.s3.region}.amazonaws.com`;
    const queryParams = new URLSearchParams({
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-Date': String(now),
      'X-Amz-Signature': signature,
      'X-Amz-Bucket': this.s3.bucket,
    });

    const url = `${host}/${key}?${queryParams.toString()}`;

    return {
      url,
      key,
      operation,
      expiresAt,
      headers,
    };
  }
}

export const presignedUrlService = new PresignedUrlService();
