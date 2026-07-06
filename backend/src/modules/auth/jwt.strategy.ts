import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  roles: string[];
  email?: string;
  phone?: string;
  /** Ada ('refresh') hanya pada refresh token — access token tidak punya field ini. */
  type?: string;
}

function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret) {
    // Fail-fast saat boot — jangan pernah jalan dengan secret default/kosong.
    throw new Error('JWT_SECRET wajib diset di environment');
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload) {
    // Refresh token TIDAK boleh dipakai sebagai access token — masa berlakunya
    // 7 hari dan revocation-nya hanya dicek di alur refresh, bukan di sini.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh token tidak bisa dipakai untuk mengakses API');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, phone: true, name: true, role: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User tidak ditemukan');
    }
    return user;
  }
}
