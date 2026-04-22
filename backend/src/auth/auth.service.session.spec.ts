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
import { authenticator } from '@otplib/v12-adapter';
import { createMockServices, mockSession, mockUser } from './auth.service.spec.fixtures';

describe('AuthService sessions', () => {
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