import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let auditService: {
    log: jest.Mock;
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

    service = new UsersService(prisma as any, auditService as any);
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
});
