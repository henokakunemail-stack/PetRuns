import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (plain: string) => `hashed:${plain}`),
  compare: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
}));

function makeDeps() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const config = { get: jest.fn().mockReturnValue('15m') };
  const tokens = {
    createRefreshToken: jest.fn().mockResolvedValue('refresh-token-abc'),
    verifyRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };
  return { prisma, jwt, config, tokens };
}

describe('AuthService.register', () => {
  it('hash password sebelum disimpan — tidak pernah menyimpan plaintext', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user-1', ...data }),
    );
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    await service.register({
      name: 'Budi',
      email: 'budi@example.com',
      password: 'rahasia123',
    } as any);

    const createCall = prisma.user.create.mock.calls[0][0];
    expect(createCall.data.passwordHash).toBe('hashed:rahasia123');
    expect(createCall.data.password).toBeUndefined(); // tidak pernah menyimpan field plaintext
  });

  it('menolak registrasi tanpa email maupun phone', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    await expect(service.register({ name: 'Budi', password: 'rahasia123' } as any)).rejects.toThrow(
      ConflictException,
    );
  });

  it('menolak email yang sudah terdaftar', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    await expect(
      service.register({ name: 'Budi', email: 'budi@example.com', password: 'x' } as any),
    ).rejects.toThrow('Email sudah terdaftar');
  });

  it('default role OWNER kalau tidak disebutkan', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user-1', ...data }),
    );
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    await service.register({ name: 'Budi', email: 'budi@example.com', password: 'x' } as any);

    expect(prisma.user.create.mock.calls[0][0].data.role).toEqual(['OWNER']);
  });

  it('auto-create WorkerProfile kalau role WORKER dipilih', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user-1', ...data }),
    );
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    await service.register({
      name: 'Worker Budi',
      email: 'worker@example.com',
      password: 'x',
      roles: ['WORKER'],
    } as any);

    const createCall = prisma.user.create.mock.calls[0][0];
    expect(createCall.data.workerProfile.create.verificationStatus).toBe('pending');
  });
});

describe('AuthService.login', () => {
  it('menolak kalau user tidak ditemukan', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    await expect(
      service.login({ identifier: 'nobody@example.com', password: 'x' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('menolak password yang salah', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'hashed:correct-password',
      role: ['OWNER'],
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    await expect(
      service.login({ identifier: 'budi@example.com', password: 'wrong-password' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('berhasil login dengan password yang benar & mengembalikan access+refresh token', async () => {
    const { prisma, jwt, config, tokens } = makeDeps();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Budi',
      email: 'budi@example.com',
      phone: null,
      passwordHash: 'hashed:correct-password',
      role: ['OWNER'],
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, tokens as any);

    const result = await service.login({
      identifier: 'budi@example.com',
      password: 'correct-password',
    } as any);

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.refreshToken).toBe('refresh-token-abc');
    expect(result.user.id).toBe('user-1');
  });
});
