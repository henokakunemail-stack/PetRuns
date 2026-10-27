import { AuthController } from './auth.controller';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthController', () => {
  it('meneruskan refresh token lengkap ke AuthService', async () => {
    const authService = {
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new-access' }),
      logout: jest.fn(),
    };
    const controller = new AuthController(authService as any);
    const refreshToken = 'jti-123.signed.refresh.jwt';

    await controller.refresh({ refreshToken });

    expect(authService.refresh).toHaveBeenCalledWith(refreshToken);
  });

  it('meneruskan refresh token lengkap saat logout agar jti bisa direvoke', async () => {
    const authService = {
      refresh: jest.fn(),
      logout: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new AuthController(authService as any);
    const refreshToken = 'jti-123.signed.refresh.jwt';

    await controller.logout(refreshToken);

    expect(authService.logout).toHaveBeenCalledWith(refreshToken);
  });
});
