import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';
import * as bcrypt from 'bcrypt';

export type Role = 'OWNER' | 'WORKER' | 'ADMIN';

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  roles: Role[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: Role[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Email atau nomor HP wajib diisi');
    }

    if (dto.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email sudah terdaftar');
    }
    if (dto.phone) {
      const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (exists) throw new ConflictException('Nomor HP sudah terdaftar');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const roles = (dto.roles && dto.roles.length > 0 ? dto.roles : ['OWNER']) as Role[];

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: roles,
        // Auto-create WorkerProfile when registering as WORKER
        ...(roles.includes('WORKER')
          ? {
              workerProfile: {
                create: { bio: '', verificationStatus: 'pending' },
              },
            }
          : {}),
      },
      include: roles.includes('WORKER') ? { workerProfile: true } : undefined,
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        deletedAt: null,
      },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Kredensial tidak valid');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Kredensial tidak valid');

    return this.buildAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const userId = await this.tokens.verifyRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
    await this.tokens.revokeRefreshToken(refreshToken);
    return this.buildAuthResult(user);
  }

  async logout(refreshToken: string | undefined): Promise<{ success: boolean }> {
    if (refreshToken) {
      await this.tokens.revokeRefreshToken(refreshToken);
    }
    return { success: true };
  }

  private async buildAuthResult(user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: Role[];
  }): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      roles: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.tokens.createRefreshToken(user.id);

    const expiresIn = this.parseExpiryToSeconds(this.config.get<string>('JWT_EXPIRES_IN') ?? '15m');

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roles: user.role,
      },
    };
  }

  private parseExpiryToSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 900;
    const n = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        return 900;
    }
  }
}
