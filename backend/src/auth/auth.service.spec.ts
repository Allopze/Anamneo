import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let prismaService: {
    loginAttempt: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;
  let auditService: { log: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    nombre: 'Test User',
    role: 'MEDICO',
    isAdmin: false,
    active: true,
    refreshTokenVersion: 1,
  };

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    tokenVersion: 1,
    userAgent: null,
    ipAddress: null,
    revokedAt: null,
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      countUsers: jest.fn(),
      countActiveAdmins: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findAuthById: jest.fn().mockResolvedValue(mockUser),
      findInvitationByToken: jest.fn().mockResolvedValue(null),
      acceptInvitation: jest.fn(),
      rotateRefreshTokenVersion: jest.fn().mockResolvedValue(2),
      createSession: jest.fn().mockResolvedValue(mockSession),
      findActiveSessionById: jest.fn().mockResolvedValue(mockSession),
      rotateSessionTokenVersion: jest.fn().mockResolvedValue({
        ...mockSession,
        tokenVersion: 2,
      }),
      revokeSessionById: jest.fn(),
      revokeAllSessionsForUser: jest.fn(),
    };

    prismaService = {
      loginAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
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
      (usersService.findInvitationByToken as jest.Mock).mockResolvedValue({
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
      expect(usersService.acceptInvitation).toHaveBeenCalledWith('invite-1');
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
      (usersService.findInvitationByToken as jest.Mock).mockResolvedValue({
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
  });

  describe('refreshTokens', () => {
    it('should return new tokens for valid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        rv: 1,
        sid: 'session-1',
        sv: 1,
      });
      (usersService.findAuthById as jest.Mock).mockResolvedValue(mockUser);
      (usersService.findActiveSessionById as jest.Mock).mockResolvedValue(mockSession);
      (usersService.rotateSessionTokenVersion as jest.Mock).mockResolvedValue({
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

  describe('getBootstrapState', () => {
    it('should return isEmpty true when no users exist', async () => {
      (usersService.countUsers as jest.Mock).mockResolvedValue(0);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(0);

      const result = await service.getBootstrapState();

      expect(result).toEqual({
        userCount: 0,
        isEmpty: true,
        hasAdmin: false,
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
        registerableRoles: [],
      });
    });
  });
});
