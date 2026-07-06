import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function makeDeps() {
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  const prisma = { user: { findUnique: jest.fn() } };
  return { config, prisma };
}

describe('JwtStrategy.validate', () => {
  it('menolak refresh token dipakai sebagai access token', async () => {
    const { config, prisma } = makeDeps();
    const strategy = new JwtStrategy(config as any, prisma as any);

    await expect(strategy.validate({ sub: 'user-1', roles: [], type: 'refresh' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('menolak user yang sudah dihapus (soft delete)', async () => {
    const { config, prisma } = makeDeps();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', deletedAt: new Date() });
    const strategy = new JwtStrategy(config as any, prisma as any);

    await expect(strategy.validate({ sub: 'user-1', roles: [] })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('meloloskan access token normal & mengembalikan user dari DB', async () => {
    const { config, prisma } = makeDeps();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Budi',
      role: ['OWNER'],
      deletedAt: null,
    });
    const strategy = new JwtStrategy(config as any, prisma as any);

    const user = await strategy.validate({ sub: 'user-1', roles: ['OWNER'] });

    expect(user.id).toBe('user-1');
    expect(user.role).toEqual(['OWNER']);
  });

  it('fail-fast saat boot kalau JWT_SECRET tidak diset', () => {
    const prisma = { user: { findUnique: jest.fn() } };
    const config = { get: jest.fn().mockReturnValue(undefined) };

    expect(() => new JwtStrategy(config as any, prisma as any)).toThrow(
      'JWT_SECRET wajib diset di environment',
    );
  });
});
