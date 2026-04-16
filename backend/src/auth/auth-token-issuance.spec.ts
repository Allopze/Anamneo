import { UnauthorizedException } from '@nestjs/common';
import { issueTokensWithSession } from './auth-token-issuance';

describe('issueTokensWithSession', () => {
  const user = { id: 'user-1', email: 'medico@test.com', role: 'MEDICO' };

  let sessionService: any;
  let jwtService: any;
  let configService: any;

  beforeEach(() => {
    sessionService = {
      findAuthById: jest.fn(),
      createSession: jest.fn(),
      rotateSessionTokenVersion: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('refresh-secret'),
      get: jest.fn().mockReturnValue('7d'),
    };
  });

  it('throws UnauthorizedException when auth user is missing', async () => {
    sessionService.findAuthById.mockResolvedValue(null);

    await expect(
      issueTokensWithSession({
        sessionService,
        jwtService,
        configService,
        user,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('creates a new session and returns access/refresh tokens', async () => {
    sessionService.findAuthById.mockResolvedValue({
      id: user.id,
      active: true,
      refreshTokenVersion: 3,
    });
    sessionService.createSession.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      tokenVersion: 7,
    });
    jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

    const result = await issueTokensWithSession({
      sessionService,
      jwtService,
      configService,
      user,
      sessionContext: { ipAddress: '127.0.0.1' },
    });

    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(sessionService.createSession).toHaveBeenCalledWith(user.id, { ipAddress: '127.0.0.1' });
    expect(sessionService.rotateSessionTokenVersion).not.toHaveBeenCalled();
    expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    expect(jwtService.sign).toHaveBeenNthCalledWith(
      2,
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        rv: 3,
        sid: 'session-1',
        sv: 7,
      },
      {
        secret: 'refresh-secret',
        expiresIn: '7d',
      },
    );
  });

  it('rotates existing session token version when sessionId is provided', async () => {
    sessionService.findAuthById.mockResolvedValue({
      id: user.id,
      active: true,
      refreshTokenVersion: 4,
    });
    sessionService.rotateSessionTokenVersion.mockResolvedValue({
      id: 'session-9',
      userId: user.id,
      tokenVersion: 2,
    });
    jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

    await issueTokensWithSession({
      sessionService,
      jwtService,
      configService,
      user,
      sessionContext: { sessionId: 'session-9', userAgent: 'jest' },
    });

    expect(sessionService.rotateSessionTokenVersion).toHaveBeenCalledWith('session-9', {
      sessionId: 'session-9',
      userAgent: 'jest',
    });
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when session does not belong to auth user', async () => {
    sessionService.findAuthById.mockResolvedValue({
      id: user.id,
      active: true,
      refreshTokenVersion: 1,
    });
    sessionService.createSession.mockResolvedValue({
      id: 'session-1',
      userId: 'another-user',
      tokenVersion: 1,
    });

    await expect(
      issueTokensWithSession({
        sessionService,
        jwtService,
        configService,
        user,
      }),
    ).rejects.toThrow('Sesión inválida');
  });
});
