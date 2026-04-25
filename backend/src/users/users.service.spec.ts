import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let auditService: {
    log: jest.Mock;
  };
  let usersSessionService: {
    rotateRefreshTokenVersion: jest.Mock;
    revokeAllSessionsForUser: jest.Mock;
  };
  let prisma: {
    user: {
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = {
      log: jest.fn(),
    };

    usersSessionService = {
      rotateRefreshTokenVersion: jest.fn(),
      revokeAllSessionsForUser: jest.fn(),
    };

    service = new UsersService(prisma as any, auditService as any, usersSessionService as any);
  });

  describe('update', () => {
    it('rejects deactivating the last active admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@test.com',
        role: 'ADMIN',
        isAdmin: true,
        active: true,
        medicoId: null,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update('admin-1', { active: false }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects removing admin role from the last active admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@test.com',
        role: 'ADMIN',
        isAdmin: true,
        active: true,
        medicoId: null,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update('admin-1', { role: 'MEDICO' as any }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('revokes sessions when an admin changes a password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'med@test.com',
        nombre: 'Medico',
        role: 'MEDICO',
        isAdmin: false,
        active: true,
        medicoId: null,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'med@test.com',
        nombre: 'Medico',
        role: 'MEDICO',
        medicoId: null,
        isAdmin: false,
        active: true,
        updatedAt: new Date(),
      });

      await service.update('user-1', { password: 'Password1' }, 'actor-1');

      expect(usersSessionService.rotateRefreshTokenVersion).toHaveBeenCalledWith('user-1');
      expect(usersSessionService.revokeAllSessionsForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('remove', () => {
    it('rejects removing the last active admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@test.com',
        role: 'ADMIN',
        isAdmin: true,
        active: true,
        medicoId: null,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.remove('admin-1', 'actor-1')).rejects.toThrow(ConflictException);
    });

    it('throws when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', 'actor-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('clears prior TOTP enrollment and revokes sessions on admin reset', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'med@test.com',
        totpEnabled: true,
        totpSecret: 'enc:v1:secret',
        totpRecoveryCodes: '["hash:ABCD1234"]',
      });

      await service.resetPassword('user-1', 'Temporal123', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          mustChangePassword: true,
          totpEnabled: false,
          totpSecret: null,
          totpRecoveryCodes: null,
          passwordHash: expect.any(String),
        }),
      });
      expect(usersSessionService.rotateRefreshTokenVersion).toHaveBeenCalledWith('user-1');
      expect(usersSessionService.revokeAllSessionsForUser).toHaveBeenCalledWith('user-1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'User',
          entityId: 'user-1',
          userId: 'admin-1',
          action: 'PASSWORD_CHANGED',
          diff: {
            reset: expect.objectContaining({
              id: 'user-1',
              email: 'med@test.com',
              temporary: true,
              totpEnrollmentReset: true,
            }),
          },
        }),
      );
    });
  });
});
