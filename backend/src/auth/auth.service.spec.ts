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
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { authenticator } from '@otplib/v12-adapter';
import { mockUser, mockSession, createMockServices } from './auth.service.spec.fixtures';

jest.mock('bcrypt');

describe('AuthService', () => {
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

  describe('register', () => {
    it('should register ADMIN when no active admins exist', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(0);
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'ADMIN',
        bootstrapToken: 'test-secret',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMIN',
        }),
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should register subsequent users with requested role', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(1);
      (invitationService.findInvitationByToken as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        email: 'test2@example.com',
        role: 'ASISTENTE',
        medicoId: 'medico-1',
        invitedById: 'admin-1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      await service.register({
        email: 'test2@example.com',
        password: 'Password1',
        nombre: 'Test User 2',
        role: 'ASISTENTE',
        invitationToken: '0123456789abcdef0123456789abcdef',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ASISTENTE',
          medicoId: 'medico-1',
        }),
      );
      expect(invitationService.acceptInvitation).toHaveBeenCalledWith('invite-1');
    });

    it('should throw ForbiddenException if ADMIN is requested and an active admin already exists', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(1);

      await expect(
        service.register({
          email: 'test3@example.com',
          password: 'Password1',
          nombre: 'Test User 3',
          role: 'ADMIN',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should block public registration without invitation once an admin exists', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(1);

      await expect(
        service.register({
          email: 'doctor@example.com',
          password: 'Password1',
          nombre: 'Doctor',
          role: 'MEDICO',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invitation role mismatch', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(1);
      (invitationService.findInvitationByToken as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        email: 'doctor@example.com',
        role: 'ASISTENTE',
        medicoId: 'medico-1',
        invitedById: 'admin-1',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.register({
          email: 'doctor@example.com',
          password: 'Password1',
          nombre: 'Doctor',
          role: 'MEDICO',
          invitationToken: '0123456789abcdef0123456789abcdef',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invitation when assigned medico is inactive', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(1);
      (invitationService.findInvitationByToken as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        email: 'assistant@example.com',
        role: 'ASISTENTE',
        medicoId: 'medico-1',
        invitedById: 'admin-1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 'medico-1',
        role: 'MEDICO',
        active: false,
      });

      await expect(
        service.register({
          email: 'assistant@example.com',
          password: 'Password1',
          nombre: 'Assistant',
          role: 'ASISTENTE',
          invitationToken: '0123456789abcdef0123456789abcdef',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password1',
          nombre: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
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

  describe('refreshTokens', () => {
    it('should return new tokens for valid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        rv: 1,
        sid: 'session-1',
        sv: 1,
      });
      (sessionService.findAuthById as jest.Mock).mockResolvedValue(mockUser);
      (sessionService.findActiveSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.rotateSessionTokenVersion as jest.Mock).mockResolvedValue({
        ...mockSession,
        tokenVersion: 2,
      });

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeOtherUserSessions', () => {
    it('should revoke all sessions except the current one', async () => {
      (sessionService.revokeAllSessionsForUserExcept as jest.Mock).mockResolvedValue(2);

      const revokedCount = await service.revokeOtherUserSessions('user-1', 'session-1');

      expect(sessionService.revokeAllSessionsForUserExcept).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
      expect(revokedCount).toBe(2);
    });
  });

  describe('verify2FALogin', () => {
    it('should reject reusing the same temp token jti (single-use)', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        purpose: '2fa',
        jti: 'temp-jti-1',
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'MEDICO',
        active: true,
        totpEnabled: true,
        totpSecret: 'SECRET',
      });

      const verifySpy = jest.spyOn(authenticator, 'verify').mockReturnValue(true);

      const first = await service.verify2FALogin('temp-token', '123456');
      expect(first.tokens).toHaveProperty('accessToken');
      expect(first.userId).toBe('user-1');

      await expect(service.verify2FALogin('temp-token', '123456')).rejects.toThrow(
        'Token temporal ya utilizado',
      );

      verifySpy.mockRestore();
    });

    it('should reject temp token when purpose is not 2fa', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        purpose: 'refresh',
      });

      await expect(service.verify2FALogin('temp-token', '123456')).rejects.toThrow(
        'Token temporal inválido',
      );
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getBootstrapState', () => {
    it('should return isEmpty true when no users exist', async () => {
      (usersService.countUsers as jest.Mock).mockResolvedValue(0);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(0);

      const result = await service.getBootstrapState();

      expect(result).toEqual({
        userCount: 0,
        isEmpty: true,
        hasAdmin: false,
        requiresBootstrapToken: true,
        registerableRoles: ['ADMIN'],
      });
    });

    it('should return isEmpty false when users exist', async () => {
      (usersService.countUsers as jest.Mock).mockResolvedValue(3);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(1);

      const result = await service.getBootstrapState();

      expect(result).toEqual({
        userCount: 3,
        isEmpty: false,
        hasAdmin: true,
        requiresBootstrapToken: false,
        registerableRoles: [],
      });
    });
  });
});
