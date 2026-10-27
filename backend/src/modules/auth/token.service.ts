import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

/**
 * Refresh token implementation using signed JWT containing a random jti.
 * For an MVP this is acceptable; a production system would persist refresh
 * tokens in the DB (or Redis) so they can be revoked explicitly.
 */
@Injectable()
export class TokenService implements OnModuleInit {
  private readonly revoked = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Periodic cleanup of expired revoked-token entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  async createRefreshToken(userId: string): Promise<string> {
    const jti = crypto.randomUUID();
    const token = await this.jwt.signAsync(
      { sub: userId, jti, type: 'refresh' },
      {
        secret: this.requireRefreshSecret(),
        expiresIn: this.refreshExpiresIn,
      },
    );
    return `${jti}.${token}`;
  }

  async verifyRefreshToken(combined: string): Promise<string> {
    const dotIdx = combined.indexOf('.');
    if (dotIdx === -1) throw new UnauthorizedException('Format token tidak valid');
    const jti = combined.slice(0, dotIdx);
    const token = combined.slice(dotIdx + 1);

    if (this.revoked.has(jti)) {
      throw new UnauthorizedException('Refresh token sudah tidak berlaku');
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string; jti: string }>(
        token,
        { secret: this.requireRefreshSecret() },
      );
      if (payload.type !== 'refresh' || payload.jti !== jti) {
        throw new UnauthorizedException('Token tidak valid');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid atau sudah kadaluarsa');
    }
  }

  async revokeRefreshToken(combined: string): Promise<void> {
    const dotIdx = combined.indexOf('.');
    if (dotIdx === -1) return;
    const jti = combined.slice(0, dotIdx);
    const token = combined.slice(dotIdx + 1);

    try {
      const payload = await this.jwt.verifyAsync<{ exp: number }>(token, {
        secret: this.requireRefreshSecret(),
      });
      this.revoked.set(jti, payload.exp * 1000);
    } catch {
      // already expired; skip
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [jti, exp] of this.revoked.entries()) {
      if (exp < now) this.revoked.delete(jti);
    }
  }

  private requireRefreshSecret(): string {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET wajib diset di environment');
    }
    return secret;
  }

  private get refreshExpiresIn(): `${number}${'s' | 'm' | 'h' | 'd'}` {
    const value = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    return /^(\d+)([smhd])$/.test(value)
      ? (value as `${number}${'s' | 'm' | 'h' | 'd'}`)
      : '7d';
  }
}
