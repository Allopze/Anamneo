import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { authenticator } from '@otplib/v12-adapter';
import { AuthTotpService } from './auth-totp.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decryptStoredTotpSecret } from './auth-totp-secret';

jest.mock('bcrypt');

describe('AuthTotpService', () => {
  let service: AuthTotpService;
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: {
    log: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'SETTINGS_ENCRYPTION_KEY') return 'x'.repeat(32);
        if (key === 'SETTINGS_ENCRYPTION_KEYS') return '';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthTotpService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditService, useValue: auditService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthTotpService>(AuthTotpService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setup2FA', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.setup2FA('user-1')).rejects.toThrow(UnauthorizedException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when 2FA is already enabled', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'medico@test.com',
        totpEnabled: true,
      });

      await expect(service.setup2FA('user-1')).rejects.toThrow(BadRequestException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('generates and stores secret, then returns QR payload', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'medico@test.com',
        totpEnabled: false,
      });
      prismaService.user.update.mockResolvedValue(undefined);

      const generateSecretSpy = jest.spyOn(authenticator, 'generateSecret').mockReturnValue('SECRET123');
      const keyUriSpy = jest.spyOn(authenticator, 'keyuri').mockReturnValue('otpauth://totp/mock');
      const qrSpy = jest
        .spyOn(QRCode, 'toDataURL')
        .mockImplementation((() => Promise.resolve('data:image/png;base64,mock')) as any);

      const result = await service.setup2FA('user-1');

      expect(generateSecretSpy).toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totpSecret: expect.stringMatching(/^enc:v1:/),
        },
      });
      expect(
        decryptStoredTotpSecret(
          prismaService.user.update.mock.calls[0][0].data.totpSecret,
          configService as any,
        ),
      ).toBe('SECRET123');
      expect(keyUriSpy).toHaveBeenCalledWith('medico@test.com', 'Anamneo', 'SECRET123');
      expect(qrSpy).toHaveBeenCalledWith('otpauth://totp/mock');
      expect(result).toEqual({
        secret: 'SECRET123',
        qrCodeDataUrl: 'data:image/png;base64,mock',
      });
    });
  });

  describe('enable2FA', () => {
    it('throws BadRequestException when user has not configured a TOTP secret', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpSecret: null,
        totpEnabled: false,
      });

      await expect(service.enable2FA('user-1', '123456')).rejects.toThrow(BadRequestException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when 2FA is already enabled', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpSecret: 'enc:v1:mock',
        totpEnabled: true,
      });

      await expect(service.enable2FA('user-1', '123456')).rejects.toThrow(BadRequestException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when TOTP code is invalid', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpSecret: 'SECRET123',
        totpEnabled: false,
      });
      const verifySpy = jest.spyOn(authenticator, 'verify').mockReturnValue(false);

      await expect(service.enable2FA('user-1', '000000')).rejects.toThrow('Código TOTP inválido');
      expect(prismaService.user.update).not.toHaveBeenCalled();
      expect(verifySpy).toHaveBeenCalledWith({ token: '000000', secret: 'SECRET123' });
    });

    it('enables 2FA and emits audit log on valid code', async () => {
      const encryptedSecret = 'enc:v1:stored';
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpSecret: encryptedSecret,
        totpEnabled: false,
      });
      prismaService.user.update.mockResolvedValue(undefined);
      jest.spyOn(authenticator, 'verify').mockImplementation(({ secret }) => secret === 'SECRET123');
      jest.spyOn(require('./auth-totp-secret'), 'decryptStoredTotpSecret').mockReturnValue('SECRET123');

      const result = await service.enable2FA('user-1', '123456');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { totpEnabled: true },
      });
      expect(auditService.log).toHaveBeenCalledWith({
        entityType: 'Auth',
        entityId: 'user-1',
        userId: 'user-1',
        action: 'UPDATE',
        reason: 'AUTH_2FA_ENABLED',
        diff: { totpEnabled: true },
      });
      expect(result).toEqual({ message: '2FA habilitado correctamente' });
    });

    it('enables 2FA even when audit log rejects (fire-and-forget)', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpSecret: 'SECRET123',
        totpEnabled: false,
      });
      prismaService.user.update.mockResolvedValue(undefined);
      auditService.log.mockRejectedValue(new Error('audit unavailable'));
      jest.spyOn(authenticator, 'verify').mockReturnValue(true);

      await expect(service.enable2FA('user-1', '123456')).resolves.toEqual({
        message: '2FA habilitado correctamente',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { totpEnabled: true },
      });
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('disable2FA', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.disable2FA('user-1', 'Password1')).rejects.toThrow(UnauthorizedException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when 2FA is not enabled', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpEnabled: false,
      });

      await expect(service.disable2FA('user-1', 'Password1')).rejects.toThrow(BadRequestException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpEnabled: true,
        passwordHash: '$2b$10$hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.disable2FA('user-1', 'WrongPass1')).rejects.toThrow('Contraseña incorrecta');
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('disables 2FA, clears secret and emits audit log on valid password', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpEnabled: true,
        passwordHash: '$2b$10$hash',
      });
      prismaService.user.update.mockResolvedValue(undefined);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.disable2FA('user-1', 'Password1');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { totpEnabled: false, totpSecret: null },
      });
      expect(auditService.log).toHaveBeenCalledWith({
        entityType: 'Auth',
        entityId: 'user-1',
        userId: 'user-1',
        action: 'UPDATE',
        reason: 'AUTH_2FA_DISABLED',
        diff: { totpEnabled: false },
      });
      expect(result).toEqual({ message: '2FA deshabilitado correctamente' });
    });

    it('disables 2FA even when audit log rejects (fire-and-forget)', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpEnabled: true,
        passwordHash: '$2b$10$hash',
      });
      prismaService.user.update.mockResolvedValue(undefined);
      auditService.log.mockRejectedValue(new Error('audit unavailable'));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.disable2FA('user-1', 'Password1')).resolves.toEqual({
        message: '2FA deshabilitado correctamente',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { totpEnabled: false, totpSecret: null },
      });
      expect(auditService.log).toHaveBeenCalled();
    });
  });
});
