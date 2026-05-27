import { authenticator } from '@otplib/v12-adapter';
import * as bcrypt from 'bcrypt';
import { verify2FALoginFlow } from './auth-2fa-flow';

jest.mock('bcrypt');

describe('verify2FALoginFlow', () => {
  let jwtService: any;
  let prisma: any;
  let issueTokens: jest.Mock;
  let jtiStore: { hasUsed: jest.Mock; markUsed: jest.Mock };

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    issueTokens = jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    jtiStore = {
      hasUsed: jest.fn().mockResolvedValue(false),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws UnauthorizedException when temp token is invalid', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        jtiStore,
        tempTokenTtlMs: 300_000,
        tempToken: 'bad-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Token temporal inválido o expirado');
  });

  it('throws UnauthorizedException when token purpose is not 2fa', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: 'refresh' });

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        jtiStore,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Token temporal inválido');
  });

  it('throws UnauthorizedException when temp token jti was already consumed', async () => {
    jtiStore.hasUsed.mockResolvedValue(true);
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa', jti: 'temp-jti' });

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        jtiStore,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Token temporal ya utilizado');
    expect(jtiStore.hasUsed).toHaveBeenCalledWith('temp-jti');
  });

  it('throws UnauthorizedException when user is missing or 2FA is not configured', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa' });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        jtiStore,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Usuario no encontrado o 2FA no configurado');
  });

  it('throws UnauthorizedException when TOTP code is invalid and does not consume jti', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa', jti: 'temp-jti-invalid' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'medico@test.com',
      role: 'MEDICO',
      active: true,
      totpEnabled: true,
      totpSecret: 'SECRET',
      totpRecoveryCodes: null,
    });
    jest.spyOn(authenticator, 'verify').mockReturnValue(false);

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        jtiStore,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Código de verificación inválido');
    expect(jtiStore.markUsed).not.toHaveBeenCalled();
  });

  it('accepts a valid recovery code, consumes it, and marks jti used', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa', jti: 'temp-jti-recovery' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'medico@test.com',
      role: 'MEDICO',
      active: true,
      totpEnabled: true,
      totpSecret: 'SECRET',
      totpRecoveryCodes: JSON.stringify(['hash:ABCD1234', 'hash:WXYZ5678']),
    });
    jest.spyOn(authenticator, 'verify').mockReturnValue(false);
    (bcrypt.compare as jest.Mock).mockImplementation(async (code: string, hash: string) => (
      code === 'ABCD1234' && hash === 'hash:ABCD1234'
    ));

    const result = await verify2FALoginFlow({
      jwtService,
      prisma,
      jtiStore,
      tempTokenTtlMs: 300_000,
      tempToken: 'temp-token',
      code: 'ABCD-1234',
      issueTokens,
      resolveTotpSecret: (secret) => secret,
    });

    expect(result).toEqual({
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      userId: 'user-1',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { totpRecoveryCodes: JSON.stringify(['hash:WXYZ5678']) },
    });
    expect(jtiStore.markUsed).toHaveBeenCalledWith('temp-jti-recovery', expect.any(Date));
  });

  it('returns auth tokens and marks jti used on valid TOTP verification', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa', jti: 'temp-jti-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'medico@test.com',
      role: 'MEDICO',
      active: true,
      totpEnabled: true,
      totpSecret: 'SECRET',
      totpRecoveryCodes: null,
    });
    jest.spyOn(authenticator, 'verify').mockReturnValue(true);

    const result = await verify2FALoginFlow({
      jwtService,
      prisma,
      jtiStore,
      tempTokenTtlMs: 300_000,
      tempToken: 'temp-token',
      code: '123456',
      sessionContext: { ipAddress: '127.0.0.1' },
      issueTokens,
      resolveTotpSecret: (secret) => secret,
    });

    expect(result).toEqual({
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      userId: 'user-1',
    });
    expect(issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'medico@test.com', role: 'MEDICO' }),
      { ipAddress: '127.0.0.1' },
    );
    expect(jtiStore.markUsed).toHaveBeenCalledWith('temp-jti-1', expect.any(Date));
  });
});
