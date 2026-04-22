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
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { createMockServices, mockUser } from './auth.service.spec.fixtures';

describe('AuthService register', () => {
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
