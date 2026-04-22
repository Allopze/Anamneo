import { UnauthorizedException } from '@nestjs/common';
import { refreshTokensFlow } from './auth-refresh-flow';

describe('refreshTokensFlow', () => {
  let jwtService: any;
  let configService: any;
  let sessionService: any;
  let issueTokens: jest.Mock;

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('refresh-secret'),
    };

    sessionService = {
      findAuthById: jest.fn(),
      findActiveSessionById: jest.fn(),
      revokeSessionById: jest.fn(),
    };

    issueTokens = jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('returns new tokens when refresh payload and session metadata are valid', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      rv: 4,
      sid: 'session-1',
      sv: 2,
    });
    sessionService.findAuthById.mockResolvedValue({
      id: 'user-1',
      email: 'medico@test.com',
      role: 'MEDICO',
      active: true,
      refreshTokenVersion: 4,
    });
    sessionService.findActiveSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenVersion: 2,
      lastUsedAt: new Date(),
    });

    const result = await refreshTokensFlow({
      jwtService,
      configService,
      sessionService,
      refreshToken: 'refresh-token',
      sessionContext: { userAgent: 'jest' },
      issueTokens,
      sessionInactivityTimeoutMinutes: 15,
    });

    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'medico@test.com', role: 'MEDICO' }),
      {
        userAgent: 'jest',
        sessionId: 'session-1',
      },
    );
  });

  it('throws UnauthorizedException when jwt verification fails', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(
      refreshTokensFlow({
        jwtService,
        configService,
        sessionService,
        refreshToken: 'bad-token',
        issueTokens,
        sessionInactivityTimeoutMinutes: 15,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when refresh token version does not match user version', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      rv: 3,
      sid: 'session-1',
      sv: 2,
    });
    sessionService.findAuthById.mockResolvedValue({
      id: 'user-1',
      active: true,
      refreshTokenVersion: 4,
    });

    await expect(
      refreshTokensFlow({
        jwtService,
        configService,
        sessionService,
        refreshToken: 'refresh-token',
        issueTokens,
        sessionInactivityTimeoutMinutes: 15,
      }),
    ).rejects.toThrow('Token de refresco inválido');
  });

  it('throws UnauthorizedException when sid/sv metadata is missing', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      rv: 4,
    });
    sessionService.findAuthById.mockResolvedValue({
      id: 'user-1',
      active: true,
      refreshTokenVersion: 4,
    });

    await expect(
      refreshTokensFlow({
        jwtService,
        configService,
        sessionService,
        refreshToken: 'refresh-token',
        issueTokens,
        sessionInactivityTimeoutMinutes: 15,
      }),
    ).rejects.toThrow('Token de refresco inválido');
  });

  it('throws UnauthorizedException when active session does not match payload/session owner', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      rv: 4,
      sid: 'session-1',
      sv: 2,
    });
    sessionService.findAuthById.mockResolvedValue({
      id: 'user-1',
      active: true,
      refreshTokenVersion: 4,
    });
    sessionService.findActiveSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'other-user',
      tokenVersion: 2,
      lastUsedAt: new Date(),
    });

    await expect(
      refreshTokensFlow({
        jwtService,
        configService,
        sessionService,
        refreshToken: 'refresh-token',
        issueTokens,
        sessionInactivityTimeoutMinutes: 15,
      }),
    ).rejects.toThrow('Token de refresco inválido');
  });

  it('revokes the session when it expired by inactivity', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      rv: 4,
      sid: 'session-1',
      sv: 2,
    });
    sessionService.findAuthById.mockResolvedValue({
      id: 'user-1',
      active: true,
      refreshTokenVersion: 4,
    });
    sessionService.findActiveSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenVersion: 2,
      lastUsedAt: new Date(Date.now() - 16 * 60 * 1000),
    });

    await expect(
      refreshTokensFlow({
        jwtService,
        configService,
        sessionService,
        refreshToken: 'refresh-token',
        issueTokens,
        sessionInactivityTimeoutMinutes: 15,
      }),
    ).rejects.toThrow('Sesión expirada por inactividad');

    expect(sessionService.revokeSessionById).toHaveBeenCalledWith('session-1');
  });
});
