import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientsBlockingService } from './patients-blocking.service';

describe('PatientsBlockingService', () => {
  const baseUser = { id: 'user-1' } as never;

  function buildService(overrides?: {
    findUnique?: jest.Mock;
    update?: jest.Mock;
    auditLog?: jest.Mock;
  }) {
    const findUnique = overrides?.findUnique ?? jest.fn();
    const update = overrides?.update ?? jest.fn();
    const auditLog = overrides?.auditLog ?? jest.fn().mockResolvedValue(undefined);
    const prisma = { patient: { findUnique, update } } as never;
    const audit = { log: auditLog } as never;
    return { service: new PatientsBlockingService(prisma, audit), findUnique, update, auditLog };
  }

  describe('block', () => {
    it('rechaza razon corta', async () => {
      const { service } = buildService();
      await expect(service.block('p-1', 'corta', baseUser)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si el paciente no existe', async () => {
      const { service, findUnique } = buildService({ findUnique: jest.fn().mockResolvedValue(null) });
      await expect(
        service.block('p-1', 'razon valida con suficiente largo', baseUser),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(findUnique).toHaveBeenCalled();
    });

    it('rechaza si ya esta bloqueado', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: new Date() }),
      });
      await expect(
        service.block('p-1', 'razon valida con suficiente largo', baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('bloquea correctamente y registra auditoria', async () => {
      const updateResult = { id: 'p-1', blockedAt: new Date(), blockedReason: 'r', blockedById: 'user-1' };
      const { service, update, auditLog } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null }),
        update: jest.fn().mockResolvedValue(updateResult),
      });
      const out = await service.block('p-1', 'razon valida con suficiente largo', baseUser);
      expect(out).toBe(updateResult);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ blockedReason: expect.any(String), blockedById: 'user-1' }),
      }));
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
        entityType: 'Patient',
        entityId: 'p-1',
        reason: 'PATIENT_BLOCKED',
        action: 'UPDATE',
      }));
    });
  });

  describe('unblock', () => {
    it('rechaza si no esta bloqueado', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null }),
      });
      await expect(
        service.unblock('p-1', 'razon valida con suficiente largo', baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('desbloquea correctamente y registra auditoria', async () => {
      const { service, update, auditLog } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: new Date(), blockedReason: 'prev' }),
        update: jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null }),
      });
      await service.unblock('p-1', 'razon valida con suficiente largo', baseUser);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: { blockedAt: null, blockedReason: null, blockedById: null },
      }));
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'PATIENT_UNBLOCKED',
      }));
    });
  });
});
