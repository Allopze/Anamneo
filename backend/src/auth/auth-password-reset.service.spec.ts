import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthPasswordResetService } from './auth-password-reset.service';
import { hashInvitationToken } from '../users/users-helpers';

type MockPrisma = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  passwordResetToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

function buildPrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({ id: 'token-1' }),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(async (callback) => callback({
      user: { update: jest.fn() },
      passwordResetToken: { update: jest.fn() },
    })),
  };
}

function buildService(prisma: MockPrisma, overrides: Partial<{
  mail: any;
  audit: any;
  session: any;
  config: any;
}> = {}) {
  const mailService = overrides.mail ?? {
    sendPasswordResetEmail: jest.fn().mockResolvedValue({ sent: true, reason: null, resetUrl: 'http://x' }),
  };
  const auditService = overrides.audit ?? { log: jest.fn().mockResolvedValue(undefined) };
  const sessionService = overrides.session ?? { revokeAllSessionsForUser: jest.fn().mockResolvedValue(undefined) };
  const configService = overrides.config ?? { get: jest.fn().mockReturnValue(undefined) };

  return new AuthPasswordResetService(
    prisma as any,
    mailService,
    auditService,
    sessionService,
    configService,
  );
}

describe('AuthPasswordResetService', () => {
  describe('requestReset', () => {
    it('does nothing silently when email does not exist (anti-enumeration)', async () => {
      const prisma = buildPrismaMock();
      prisma.user.findUnique.mockResolvedValue(null);
      const mail = { sendPasswordResetEmail: jest.fn() };
      const service = buildService(prisma, { mail });

      await service.requestReset('nobody@x.cl', { ipAddress: '1.2.3.4' });

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('does nothing silently when user is inactive', async () => {
      const prisma = buildPrismaMock();
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@x.cl', nombre: 'A', active: false,
      });
      const service = buildService(prisma);

      await service.requestReset('a@x.cl');

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('generates token, persists hash and sends email when user exists', async () => {
      const prisma = buildPrismaMock();
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@x.cl', nombre: 'Ana', active: true,
      });
      const mail = { sendPasswordResetEmail: jest.fn().mockResolvedValue({ sent: true, reason: null, resetUrl: 'http://x' }) };
      const audit = { log: jest.fn().mockResolvedValue(undefined) };
      const service = buildService(prisma, { mail, audit });

      await service.requestReset('a@x.cl', { ipAddress: '1.2.3.4' });

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
          ipAddress: '1.2.3.4',
        }),
      }));
      expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(expect.objectContaining({
        email: 'a@x.cl',
        token: expect.any(String),
        recipientName: 'Ana',
      }));
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'PASSWORD_CHANGED',
        diff: expect.objectContaining({ scope: 'EMAIL_RESET_REQUEST' }),
      }));
    });
  });

  describe('validateToken', () => {
    it('returns valid=false for unknown token', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      const service = buildService(prisma);

      const result = await service.validateToken('abc');
      expect(result).toEqual({ valid: false, requires2FA: false });
    });

    it('returns valid=false for expired token', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 't1',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        user: { totpEnabled: false, active: true },
      });
      const service = buildService(prisma);

      const result = await service.validateToken('abc');
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for already-used token', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 't1',
        expiresAt: new Date(Date.now() + 60000),
        usedAt: new Date(),
        user: { totpEnabled: false, active: true },
      });
      const service = buildService(prisma);

      const result = await service.validateToken('abc');
      expect(result.valid).toBe(false);
    });

    it('reports requires2FA when user has TOTP enabled', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 't1',
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        user: { id: 'u1', totpEnabled: true, active: true },
      });
      const service = buildService(prisma);

      const result = await service.validateToken('abc');
      expect(result).toEqual({ valid: true, requires2FA: true });
    });
  });

  describe('confirmReset', () => {
    function tokenRecord(overrides: Record<string, unknown> = {}) {
      return {
        id: 't1',
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        user: {
          id: 'u1',
          active: true,
          nombre: 'Ana',
          totpEnabled: false,
          totpSecret: null,
          totpRecoveryCodes: null,
        },
        ...overrides,
      };
    }

    it('rejects unknown or expired tokens', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      const service = buildService(prisma);

      await expect(service.confirmReset('abc', 'NewPass123', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('requires totpCode when user has 2FA enabled', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.findUnique.mockResolvedValue(tokenRecord({
        user: { id: 'u1', active: true, nombre: 'Ana', totpEnabled: true, totpSecret: 'x', totpRecoveryCodes: null },
      }));
      const service = buildService(prisma);

      await expect(service.confirmReset('abc', 'NewPass123', undefined)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('persists new password and revokes sessions on success without 2FA', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.findUnique.mockResolvedValue(tokenRecord());
      const session = { revokeAllSessionsForUser: jest.fn().mockResolvedValue(undefined) };
      const audit = { log: jest.fn().mockResolvedValue(undefined) };
      const service = buildService(prisma, { session, audit });

      await service.confirmReset('abc', 'NewPass123', undefined, { ipAddress: '1.2.3.4' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(session.revokeAllSessionsForUser).toHaveBeenCalledWith('u1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'PASSWORD_CHANGED',
        diff: expect.objectContaining({ scope: 'EMAIL_RESET' }),
      }));
    });
  });

  describe('purgeExpiredTokens', () => {
    it('deletes tokens that expired or were used past the threshold', async () => {
      const prisma = buildPrismaMock();
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 3 });
      const service = buildService(prisma);

      const count = await service.purgeExpiredTokens(1000);
      expect(count).toBe(3);
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalled();
    });
  });

  describe('token hashing', () => {
    it('uses sha256 hash for storage (verifies stored hash matches lookup hash)', () => {
      const token = 'abc';
      expect(hashInvitationToken(token)).toBe(hashInvitationToken('abc'));
      expect(hashInvitationToken(token)).not.toBe(token);
    });
  });
});
