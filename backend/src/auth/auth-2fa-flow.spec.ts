import { authenticator } from '@otplib/v12-adapter';
import { verify2FALoginFlow } from './auth-2fa-flow';

describe('verify2FALoginFlow', () => {
  let jwtService: any;
  let prisma: any;
  let issueTokens: jest.Mock;
  let usedTempTokenJtis: Map<string, number>;

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    issueTokens = jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    usedTempTokenJtis = new Map<string, number>();
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
        usedTempTokenJtis,
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
        usedTempTokenJtis,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Token temporal inválido');
  });

  it('throws UnauthorizedException when temp token jti was already consumed', async () => {
    usedTempTokenJtis.set('temp-jti', Date.now() + 300_000);
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa', jti: 'temp-jti' });

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        usedTempTokenJtis,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Token temporal ya utilizado');
  });

  it('throws UnauthorizedException when user is missing or 2FA is not configured', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa' });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        usedTempTokenJtis,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Usuario no encontrado o 2FA no configurado');
  });

  it('throws UnauthorizedException when TOTP code is invalid', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'medico@test.com',
      role: 'MEDICO',
      active: true,
      totpEnabled: true,
      totpSecret: 'SECRET',
    });
    jest.spyOn(authenticator, 'verify').mockReturnValue(false);

    await expect(
      verify2FALoginFlow({
        jwtService,
        prisma,
        usedTempTokenJtis,
        tempTokenTtlMs: 300_000,
        tempToken: 'temp-token',
        code: '123456',
        issueTokens,
        resolveTotpSecret: (secret) => secret,
      }),
    ).rejects.toThrow('Código TOTP inválido');
  });

  it('returns auth tokens, userId and consumes jti on valid 2FA verification', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa', jti: 'temp-jti-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'medico@test.com',
      role: 'MEDICO',
      active: true,
      totpEnabled: true,
      totpSecret: 'SECRET',
    });
    jest.spyOn(authenticator, 'verify').mockReturnValue(true);

    const result = await verify2FALoginFlow({
      jwtService,
      prisma,
      usedTempTokenJtis,
      tempTokenTtlMs: 300_000,
      tempToken: 'temp-token',
      code: '123456',
      sessionContext: { ipAddress: '127.0.0.1' },
      issueTokens,
      resolveTotpSecret: (secret) => secret,
    });

    expect(result).toEqual({
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      userId: 'user-1',
    });
    expect(issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'medico@test.com', role: 'MEDICO' }),
      { ipAddress: '127.0.0.1' },
    );
    expect(usedTempTokenJtis.has('temp-jti-1')).toBe(true);
  });

  it('purges expired consumed jtis before validating a new temp token', async () => {
    usedTempTokenJtis.set('expired-jti', Date.now() - 1);
    jwtService.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa', jti: 'temp-jti-2' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'medico@test.com',
      role: 'MEDICO',
      active: true,
      totpEnabled: true,
      totpSecret: 'SECRET',
    });
    jest.spyOn(authenticator, 'verify').mockReturnValue(true);

    await verify2FALoginFlow({
      jwtService,
      prisma,
      usedTempTokenJtis,
      tempTokenTtlMs: 300_000,
      tempToken: 'temp-token',
      code: '123456',
      issueTokens,
      resolveTotpSecret: (secret) => secret,
    });

    expect(usedTempTokenJtis.has('expired-jti')).toBe(false);
    expect(usedTempTokenJtis.has('temp-jti-2')).toBe(true);
  });
});
