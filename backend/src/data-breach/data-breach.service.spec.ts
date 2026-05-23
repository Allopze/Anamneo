import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataBreachService } from './data-breach.service';
import { buildEncryptedPatientIdentifierFields } from '../patients/patients-identifiers';

describe('DataBreachService', () => {
  const baseUser = { id: 'admin-1' } as never;

  function buildService(overrides?: {
    findUnique?: jest.Mock;
    findMany?: jest.Mock;
    create?: jest.Mock;
    update?: jest.Mock;
    findPatients?: jest.Mock;
    sendBreach?: jest.Mock;
    auditLog?: jest.Mock;
  }) {
    const findUnique = overrides?.findUnique ?? jest.fn();
    const findMany = overrides?.findMany ?? jest.fn().mockResolvedValue([]);
    const create = overrides?.create ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'breach-1', ...data }));
    const update = overrides?.update ?? jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'breach-1', ...data }));
    const findPatients = overrides?.findPatients ?? jest.fn().mockResolvedValue([]);
    const sendBreach = overrides?.sendBreach ?? jest.fn().mockResolvedValue({ sent: true, reason: null });
    const auditLog = overrides?.auditLog ?? jest.fn().mockResolvedValue(undefined);

    const prisma = {
      dataBreachIncident: { findUnique, findMany, create, update },
      patient: { findMany: findPatients },
    } as never;
    const audit = { log: auditLog } as never;
    const mail = { sendBreachNotificationToSubject: sendBreach } as never;

    return {
      service: new DataBreachService(prisma, audit, mail),
      findUnique,
      create,
      update,
      sendBreach,
      auditLog,
    };
  }

  describe('create', () => {
    it('crea incidente con audit y log warning', async () => {
      const { service, create, auditLog } = buildService();
      const dto: any = {
        detectedAt: new Date().toISOString(),
        severity: 'ALTO',
        scope: 'Acceso anomalo detectado en el sistema en pruebas.',
        affectedPatientIds: ['p-1', 'p-2'],
      };
      const out = await service.create(dto, baseUser);
      expect(out.id).toBe('breach-1');
      expect(create).toHaveBeenCalled();
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
        entityType: 'DataBreachIncident',
        action: 'CREATE',
      }));
    });
  });

  describe('assess', () => {
    it('rechaza si no existe', async () => {
      const { service } = buildService({ findUnique: jest.fn().mockResolvedValue(null) });
      await expect(service.assess('x', { riskAssessment: 'evaluacion completa' } as never, baseUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marca EN_EVALUACION', async () => {
      const { service, update } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'b-1' }),
      });
      await service.assess('b-1', { riskAssessment: 'evaluacion completa con riesgo razonable identificado' } as never, baseUser);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'EN_EVALUACION' }),
      }));
    });
  });

  describe('notifyAgency', () => {
    it('rechaza si ya fue reportado a la Agencia', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'b-1', reportedToAgencyAt: new Date() }),
      });
      await expect(service.notifyAgency('b-1', {} as never, baseUser)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marca NOTIFICADO y registra timestamp', async () => {
      const { service, update, auditLog } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'b-1', reportedToAgencyAt: null }),
      });
      await service.notifyAgency('b-1', {} as never, baseUser);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'NOTIFICADO' }),
      }));
      expect(auditLog).toHaveBeenCalled();
    });
  });

  describe('notifySubjects', () => {
    it('rechaza si no hay afectados registrados', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'b-1', reportedToSubjectsAt: null, affectedPatientIds: [] }),
      });
      await expect(
        service.notifySubjects('b-1', { measuresTaken: 'medidas detalladas' } as never, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('envia notificacion a titulares con email', async () => {
      const { service, sendBreach } = buildService({
        findUnique: jest.fn().mockResolvedValue({
          id: 'b-1',
          reportedToSubjectsAt: null,
          affectedPatientIds: ['p-1', 'p-2'],
          detectedAt: new Date(),
          scope: 'incidente de prueba',
        }),
        findPatients: jest.fn().mockResolvedValue([
          { id: 'p-1', ...buildEncryptedPatientIdentifierFields({ nombre: 'A', email: 'a@example.com' }) },
          { id: 'p-2', ...buildEncryptedPatientIdentifierFields({ nombre: 'B', email: null }) }, // sin email — skipped
        ]),
      });
      const out = await service.notifySubjects(
        'b-1',
        { measuresTaken: 'medidas detalladas suficientes para pasar validacion' } as never,
        baseUser,
      );
      expect(sendBreach).toHaveBeenCalledTimes(1);
      expect((out as { deliveryStats: { sent: number; skipped: number } }).deliveryStats).toEqual({ sent: 1, skipped: 1 });
    });
  });

  describe('close', () => {
    it('rechaza si ya esta cerrado', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'b-1', status: 'CERRADO' }),
      });
      await expect(
        service.close('b-1', { postMortem: 'post-mortem completo con linea de tiempo' } as never, baseUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cierra y anexa post-mortem', async () => {
      const { service, update } = buildService({
        findUnique: jest.fn().mockResolvedValue({ id: 'b-1', status: 'NOTIFICADO', rootCause: null }),
      });
      await service.close('b-1', { postMortem: 'post-mortem completo con linea de tiempo' } as never, baseUser);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'CERRADO', rootCause: expect.stringContaining('post-mortem') }),
      }));
    });
  });
});
