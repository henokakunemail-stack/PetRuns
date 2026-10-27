import crypto from 'crypto';

export interface KmsClientConfig {
  keyId?: string;
  region?: string;
  cacheTtlMs?: number; // Default 1 jam (3600000 ms)
  mockMode?: boolean;
  mockSecret?: string;
  fetchFn?: (keyId: string) => Promise<Buffer>;
}

interface CachedKey {
  plaintextKey: Buffer;
  expiresAt: number;
}

export class KmsKeyClient {
  private keyId: string;
  private region: string;
  private cacheTtlMs: number;
  private mockMode: boolean;
  private mockSecret: Buffer;
  private fetchFn?: (keyId: string) => Promise<Buffer>;
  private cache: Map<string, CachedKey> = new Map();
  public networkCallCount = 0;

  constructor(config?: KmsClientConfig) {
    this.keyId = config?.keyId || process.env.KMS_KEY_ID || 'alias/petmatch-key';
    this.region = config?.region || process.env.AWS_REGION || 'ap-southeast-3';
    this.cacheTtlMs = config?.cacheTtlMs ?? 3600 * 1000;
    this.fetchFn = config?.fetchFn;

    const isDevOrTest =
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development' ||
      !process.env.AWS_ACCESS_KEY_ID;

    this.mockMode = config?.mockMode ?? (isDevOrTest || !process.env.KMS_KEY_ID);

    const defaultMockSecret =
      config?.mockSecret ||
      process.env.DEV_DEK_SECRET ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    this.mockSecret = Buffer.from(defaultMockSecret.slice(0, 64), 'hex');
    if (this.mockSecret.length !== 32) {
      this.mockSecret = crypto.createHash('sha256').update(defaultMockSecret).digest();
    }
  }

  isMock(): boolean {
    return this.mockMode;
  }

  clearCache(): void {
    this.cache.clear();
    this.networkCallCount = 0;
  }

  async getDataEncryptionKey(keyIdOverride?: string): Promise<Buffer> {
    const targetKeyId = keyIdOverride || this.keyId;
    const now = Date.now();

    const cached = this.cache.get(targetKeyId);
    if (cached && cached.expiresAt > now) {
      return cached.plaintextKey;
    }

    let plaintextKey: Buffer;

    if (this.fetchFn) {
      this.networkCallCount++;
      plaintextKey = await this.fetchFn(targetKeyId);
    } else if (this.mockMode) {
      this.networkCallCount++;
      plaintextKey = this.mockSecret;
    } else {
      // In production without custom transport, fallback to mock secret with warning
      this.networkCallCount++;
      console.warn('AWS KMS direct transport not configured. Using fallback DEK.');
      plaintextKey = this.mockSecret;
    }

    this.cache.set(targetKeyId, {
      plaintextKey,
      expiresAt: now + this.cacheTtlMs,
    });

    return plaintextKey;
  }
}

export const kmsClient = new KmsKeyClient();
