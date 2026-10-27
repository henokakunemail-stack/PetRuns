import crypto from 'crypto';
import { redisClient, type IRedisClient } from '../redis/redis-client.ts';
import { userRepository, UserRepository } from '../repositories/user.repository.ts';
import { hashPhone } from '../security/encryption.ts';
import { jwtService, JwtService } from '../security/jwt-service.ts';

export class HttpError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const OTP_RATE_LIMIT_MAX = 3;
export const OTP_RATE_LIMIT_TTL_SECONDS = 600; // 10 minutes
export const OTP_CODE_TTL_SECONDS = 300; // 5 minutes

export interface SendOtpResult {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  devCode?: string;
}

export interface VerifyOtpResult {
  token: string;
  user: {
    id: string;
    phone: string;
    role: 'OWNER' | 'WORKER' | 'ADMIN';
    fullName: string;
  };
}

export class OtpService {
  private redis: IRedisClient;
  private userRepo: UserRepository;
  private jwt: JwtService;

  constructor(
    redis: IRedisClient = redisClient,
    userRepo: UserRepository = userRepository,
    jwt: JwtService = jwtService
  ) {
    this.redis = redis;
    this.userRepo = userRepo;
    this.jwt = jwt;
  }

  async sendOtp(phone: string): Promise<SendOtpResult> {
    if (!phone || phone.trim().length < 8) {
      throw new HttpError('Valid phone number is required', 400);
    }

    const phoneHash = hashPhone(phone);
    const rateLimitKey = `otp:rate:${phoneHash}`;

    // Rate limit check: max 3 attempts per 10 minutes
    const currentAttempts = await this.redis.get(rateLimitKey);
    const count = currentAttempts ? parseInt(currentAttempts, 10) : 0;

    if (count >= OTP_RATE_LIMIT_MAX) {
      throw new HttpError(
        'Too many OTP attempts. Rate limit exceeded: maximum 3 requests per 10 minutes.',
        429
      );
    }

    // Increment attempt counter and ensure 10m TTL
    await this.redis.incr(rateLimitKey);
    if (count === 0) {
      await this.redis.expire(rateLimitKey, OTP_RATE_LIMIT_TTL_SECONDS);
    }

    // Generate random 6-digit OTP code
    const code = Math.floor(100000 + crypto.randomInt(900000)).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Store in Redis with 5-minute TTL
    const codeKey = `otp:code:${phoneHash}`;
    await this.redis.set(codeKey, codeHash, 'EX', OTP_CODE_TTL_SECONDS);

    const isDev = process.env.NODE_ENV !== 'production';

    return {
      success: true,
      message: 'OTP sent successfully',
      expiresInSeconds: OTP_CODE_TTL_SECONDS,
      devCode: isDev ? code : undefined,
    };
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    if (!phone || !code) {
      throw new HttpError('Phone and OTP code are required', 400);
    }

    const phoneHash = hashPhone(phone);
    const codeKey = `otp:code:${phoneHash}`;

    const storedHash = await this.redis.get(codeKey);
    if (!storedHash) {
      throw new HttpError('OTP has expired or was not requested', 400);
    }

    const incomingHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (storedHash !== incomingHash) {
      throw new HttpError('Invalid OTP code', 400);
    }

    // Invalidate OTP immediately after successful verification
    await this.redis.del(codeKey);

    // Look up or create user with OWNER role
    let user = await this.userRepo.findByPhoneHash(phoneHash);
    if (!user) {
      user = await this.userRepo.create({
        phone: phone.trim(),
        fullName: 'Pet Owner',
        role: 'OWNER',
      });
    }

    // Generate JWT token (15m validity)
    const token = await this.jwt.sign({
      userId: user.id,
      role: user.role,
      phoneHash: user.phoneHash,
      expiresInSeconds: 900,
    });

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        fullName: user.fullName,
      },
    };
  }
}

export const otpService = new OtpService();
