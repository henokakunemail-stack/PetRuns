import crypto from 'crypto';
import { redisClient, type IRedisClient } from '../redis/redis-client.ts';

export interface JwtPayload {
  sub: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
  phoneHash: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface SignTokenOptions {
  userId: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
  phoneHash: string;
  expiresInSeconds?: number; // Default 15m (900s)
}

function base64UrlEncode(str: string | Buffer): string {
  const buf = typeof str === 'string' ? Buffer.from(str, 'utf8') : str;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export class JwtService {
  private secret: string;
  private redis: IRedisClient;

  constructor(secret?: string, redis: IRedisClient = redisClient) {
    this.secret = secret || process.env.JWT_SECRET || 'petmatch-jwt-production-secret-jakarta-2026';
    this.redis = redis;
  }

  async sign(options: SignTokenOptions): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (options.expiresInSeconds || 900);
    const jti = crypto.randomUUID();

    const payload: JwtPayload = {
      sub: options.userId,
      role: options.role,
      phoneHash: options.phoneHash,
      jti,
      iat: now,
      exp,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(signatureInput)
      .digest();
    const encodedSignature = base64UrlEncode(signature);

    return `${signatureInput}.${encodedSignature}`;
  }

  async verify(token: string): Promise<JwtPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = base64UrlEncode(
      crypto.createHmac('sha256', this.secret).update(signatureInput).digest()
    );

    if (encodedSignature !== expectedSignature) {
      throw new Error('Invalid JWT signature');
    }

    const payloadRaw = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadRaw) as JwtPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new Error('JWT token expired');
    }

    // Check Redis revocation blocklist
    const isRevoked = await this.redis.get(`auth:revoked:${payload.jti}`);
    if (isRevoked) {
      throw new Error('JWT token has been revoked');
    }

    return payload;
  }

  async revoke(jti: string, remainingTtlSeconds: number): Promise<void> {
    if (remainingTtlSeconds > 0) {
      await this.redis.set(`auth:revoked:${jti}`, '1', 'EX', remainingTtlSeconds);
    }
  }
}

export const jwtService = new JwtService();
