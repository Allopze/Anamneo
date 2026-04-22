import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UsersSessionService } from '../users/users-session.service';
import { UsersInvitationService } from '../users/users-invitation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createMockServices, mockUser } from './auth.service.spec.fixtures';

jest.mock('bcrypt');

describe('AuthService login', () => {
  let service: AuthService;
  let usersService: ReturnType<typeof createMockServices>['usersService'];
  let sessionService: ReturnType<typeof createMockServices>['sessionService'];
  let invitationService: ReturnType<typeof createMockServices>['invitationService'];
  let prismaService: ReturnType<typeof createMockServices>['prismaService'];
  let jwtService: ReturnType<typeof createMockServices>['jwtService'];
  let configService: ReturnType<typeof createMockServices>['configService'];
  let auditService: ReturnType<typeof createMockServices>['auditService'];
  let settingsService: ReturnType<typeof createMockServices>['settingsService'];

  beforeEach(async () => {
    const mocks = createMockServices();
    usersService = mocks.usersService;
    sessionService = mocks.sessionService;
    invitationService = mocks.invitationService;
    prismaService = mocks.prismaService;
    jwtService = mocks.jwtService;
    configService = mocks.configService;
    auditService = mocks.auditService;
    settingsService = mocks.settingsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: UsersService, useValue: usersService },
        { provide: UsersSessionService, useValue: sessionService },
        { provide: UsersInvitationService, useValue: invitationService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should return tokens for valid credentials', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'test@example.com',
      password: 'Password1',
    });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(prismaService.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
  });

  it('should throw UnauthorizedException for invalid credentials', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'test@example.com',
        password: 'WrongPassword1',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(prismaService.loginAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'test@example.com' },
      }),
    );
  });

  it('should throw UnauthorizedException for inactive user', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue({
      ...mockUser,
      active: false,
    });

    await expect(
      service.login({
        email: 'test@example.com',
        password: 'Password1',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for non-existent user', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@example.com',
        password: 'Password1',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should block login when the persisted lockout is still active', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    prismaService.loginAttempt.findUnique.mockResolvedValue({
      email: 'test@example.com',
      failedAttempts: 5,
      lockedUntil,
    });

    await expect(
      service.login({
        email: 'test@example.com',
        password: 'Password1',
      }),
    ).rejects.toThrow('Cuenta bloqueada temporalmente');

    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('should accumulate failed attempts and block the next login after five consecutive failures', async () => {
    type LoginAttemptState = {
      email: string;
      failedAttempts: number;
      lockedUntil: Date | null;
      lastAttemptAt?: Date;
    };

    let loginAttemptState: LoginAttemptState | null = null;

    prismaService.loginAttempt.findUnique.mockImplementation(async () => loginAttemptState);
    prismaService.loginAttempt.upsert.mockImplementation(async ({ create, update }: any) => {
      const nextState = loginAttemptState ? { ...loginAttemptState, ...update } : create;
      loginAttemptState = nextState;
      return nextState;
    });
    prismaService.loginAttempt.update.mockImplementation(async ({ data }: any) => {
      if (!loginAttemptState) {
        throw new Error('Missing login attempt state');
      }
      loginAttemptState = { ...loginAttemptState, ...data };
      return loginAttemptState;
    });
    prismaService.loginAttempt.deleteMany.mockImplementation(async () => {
      loginAttemptState = null;
      return { count: 1 };
    });

    (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword1',
        }),
      ).rejects.toThrow('Credenciales inválidas');
    }

    expect((loginAttemptState as LoginAttemptState | null)?.failedAttempts).toBe(5);
    expect((loginAttemptState as LoginAttemptState | null)?.lockedUntil).toBeInstanceOf(Date);

    await expect(
      service.login({
        email: 'test@example.com',
        password: 'WrongPassword1',
      }),
    ).rejects.toThrow('Cuenta bloqueada temporalmente');
  });
});