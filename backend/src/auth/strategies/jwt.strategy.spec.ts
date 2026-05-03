import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const activeUser = {
    id: 'user-1',
    email: 'medico@test.com',
    nombre: 'Medico Demo',
    role: 'MEDICO',
    isAdmin: false,
    medicoId: null,
    mustChangePassword: false,
    totpEnabled: true,
    active: true,
  };

  const buildStrategy = (overrides?: {
    user?: unknown;
    session?: unknown;
  }) => {
    const usersService = {
      findById: jest.fn().mockResolvedValue(overrides?.user ?? activeUser),
    };
    const sessionService = {
      findActiveSessionById: jest.fn().mockResolvedValue(
        overrides?.session ?? {
          id: 'session-1',
          userId: 'user-1',
          tokenVersion: 3,
          revokedAt: null,
        },
      ),
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    return {
      strategy: new JwtStrategy(configService as any, usersService as any, sessionService as any),
      usersService,
      sessionService,
    };
  };

  it('returns the session user when access token session version is active', async () => {
    const { strategy, sessionService } = buildStrategy();

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'medico@test.com',
        role: 'MEDICO',
        sid: 'session-1',
        sv: 3,
      }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'medico@test.com',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
      mustChangePassword: false,
      totpEnabled: true,
      sessionId: 'session-1',
    });
    expect(sessionService.findActiveSessionById).toHaveBeenCalledWith('session-1');
  });

  it('rejects access tokens without session version', async () => {
    const { strategy, sessionService } = buildStrategy();

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'medico@test.com',
        role: 'MEDICO',
        sid: 'session-1',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessionService.findActiveSessionById).not.toHaveBeenCalled();
  });

  it('rejects access tokens when session was revoked or rotated', async () => {
    const { strategy } = buildStrategy({
      session: {
        id: 'session-1',
        userId: 'user-1',
        tokenVersion: 4,
        revokedAt: null,
      },
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'medico@test.com',
        role: 'MEDICO',
        sid: 'session-1',
        sv: 3,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
