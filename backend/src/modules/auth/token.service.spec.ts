import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';

describe('TokenService', () => {
  function makeService() {
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.refresh.jwt'),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-1',
        jti: 'jti-1',
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '14d';
        return undefined;
      }),
    };
    return { service: new TokenService(jwt as any, config as any), jwt, config };
  }

  it('menandatangani refresh token dengan JWT_REFRESH_SECRET dan expiry khusus refresh', async () => {
    const { service, jwt } = makeService();

    const token = await service.createRefreshToken('user-1');

    expect(token).toContain('.signed.refresh.jwt');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', type: 'refresh' }),
      { secret: 'refresh-secret', expiresIn: '14d' },
    );
  });

  it('memverifikasi format jti.jwt dengan JWT_REFRESH_SECRET', async () => {
    const { service, jwt } = makeService();

    await expect(service.verifyRefreshToken('jti-1.signed.refresh.jwt')).resolves.toBe('user-1');

    expect(jwt.verifyAsync).toHaveBeenCalledWith('signed.refresh.jwt', {
      secret: 'refresh-secret',
    });
  });

  it('menolak token yang jti-nya tidak cocok dengan payload', async () => {
    const { service } = makeService();

    await expect(service.verifyRefreshToken('different-jti.signed.refresh.jwt')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
