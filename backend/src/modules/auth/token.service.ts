import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
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

  constructor(private readonly jwt: JwtService) {}

  onModuleInit() {
    // Periodic cleanup of expired revoked-token entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  async createRefreshToken(userId: string): Promise<string> {
    const jti = crypto.randomUUID();
    const token = await this.jwt.signAsync(
      { sub: userId, jti, type: 'refresh' },
      { expiresIn: '7d' },
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
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string; jti: string }>(token);
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
      const payload = await this.jwt.verifyAsync<{ exp: number }>(token);
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
}
