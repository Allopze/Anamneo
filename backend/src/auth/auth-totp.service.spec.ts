import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { authenticator } from '@otplib/v12-adapter';
import { AuthTotpService } from './auth-totp.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as authRecoveryCodes from './auth-recovery-codes';
import * as authTotpSecret from './auth-totp-secret';

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

    (bcrypt.hash as jest.Mock).mockImplementation(async (value: string) => `hash:${value}`);

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
        authTotpSecret.decryptStoredTotpSecret(
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
      jest.spyOn(authRecoveryCodes, 'generateRecoveryCodes').mockReturnValue([
        'ABCD-EFGH',
        'JKLM-NPQR',
      ]);
      const encryptedSecret = 'enc:v1:stored';
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpSecret: encryptedSecret,
        totpEnabled: false,
      });
      prismaService.user.update.mockResolvedValue(undefined);
      jest.spyOn(authenticator, 'verify').mockImplementation(({ secret }) => secret === 'SECRET123');
      jest.spyOn(authTotpSecret, 'decryptStoredTotpSecret').mockReturnValue('SECRET123');

      const result = await service.enable2FA('user-1', '123456');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totpEnabled: true,
          totpRecoveryCodes: JSON.stringify(['hash:ABCDEFGH', 'hash:JKLMNPQR']),
        },
      });
      expect(auditService.log).toHaveBeenCalledWith({
        entityType: 'Auth',
        entityId: 'user-1',
        userId: 'user-1',
        action: 'UPDATE',
        reason: 'AUTH_2FA_ENABLED',
        diff: { totpEnabled: true, recoveryCodesIssued: 2 },
      });
      expect(result).toEqual({
        message: '2FA habilitado correctamente',
        recoveryCodes: ['ABCD-EFGH', 'JKLM-NPQR'],
      });
    });

    it('enables 2FA even when audit log rejects (fire-and-forget)', async () => {
      jest.spyOn(authRecoveryCodes, 'generateRecoveryCodes').mockReturnValue(['ABCD-EFGH']);
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
        recoveryCodes: ['ABCD-EFGH'],
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totpEnabled: true,
          totpRecoveryCodes: JSON.stringify(['hash:ABCDEFGH']),
        },
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
        data: { totpEnabled: false, totpSecret: null, totpRecoveryCodes: null },
      });
      expect(auditService.log).toHaveBeenCalledWith({
        entityType: 'Auth',
        entityId: 'user-1',
        userId: 'user-1',
        action: 'UPDATE',
        reason: 'AUTH_2FA_DISABLED',
        diff: { totpEnabled: false, recoveryCodesCleared: true },
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
        data: { totpEnabled: false, totpSecret: null, totpRecoveryCodes: null },
      });
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('throws BadRequestException when 2FA is not enabled', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpEnabled: false,
        passwordHash: '$2b$10$hash',
      });

      await expect(service.regenerateRecoveryCodes('user-1', 'Password1')).rejects.toThrow(BadRequestException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('replaces recovery codes and emits an audit log on valid password', async () => {
      jest.spyOn(authRecoveryCodes, 'generateRecoveryCodes').mockReturnValue(['WXYZ-2345', 'QRST-6789']);
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        totpEnabled: true,
        passwordHash: '$2b$10$hash',
      });
      prismaService.user.update.mockResolvedValue(undefined);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.regenerateRecoveryCodes('user-1', 'Password1');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totpRecoveryCodes: JSON.stringify(['hash:WXYZ2345', 'hash:QRST6789']),
        },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Auth',
          entityId: 'user-1',
          userId: 'user-1',
          action: 'UPDATE',
          reason: 'AUTH_2FA_RECOVERY_CODES_REGENERATED',
          diff: expect.objectContaining({
            recoveryCodesIssued: 2,
            recoveryCodesRegeneratedAt: expect.any(String),
          }),
        }),
      );
      expect(result).toEqual({
        message: 'Códigos de recuperación regenerados',
        recoveryCodes: ['WXYZ-2345', 'QRST-6789'],
      });
    });
  });
});
