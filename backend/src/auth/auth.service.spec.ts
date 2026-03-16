import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;

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

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
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
      (usersService.countUsers as jest.Mock).mockResolvedValue(1);
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      await service.register({
        email: 'test2@example.com',
        password: 'Password1',
        nombre: 'Test User 2',
        role: 'ASISTENTE',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ASISTENTE',
        }),
      );
      expect(usersService.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ isAdmin: true }),
      );
    });

    it('should throw ConflictException if ADMIN is requested and an active admin already exists', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.countActiveAdmins as jest.Mock).mockResolvedValue(1);

      await expect(
        service.register({
          email: 'test3@example.com',
          password: 'Password1',
          nombre: 'Test User 3',
          role: 'ADMIN',
        }),
      ).rejects.toThrow(ConflictException);

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
        registerableRoles: ['ADMIN', 'MEDICO', 'ASISTENTE'],
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
        registerableRoles: ['MEDICO', 'ASISTENTE'],
      });
    });
  });
});
