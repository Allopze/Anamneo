import { NotFoundException } from '@nestjs/common';
import { PatientMedicationsService } from './patient-medications.service';

describe('PatientMedicationsService', () => {
  const baseUser = { id: 'medico-1', role: 'MEDICO', isAdmin: false } as never;

  /**
   * Build a service instance with injectable mock prisma/audit doubles.
   * `assertPatientAccess` resolves when the patient exists and the user has access;
   * we model this by having prisma.patient.findUnique return a patient by default.
   */
  function buildService(overrides?: {
    findMedication?: jest.Mock;
    findManyMedications?: jest.Mock;
    createMedication?: jest.Mock;
    updateMedication?: jest.Mock;
    findPatient?: jest.Mock;
    auditLog?: jest.Mock;
  }) {
    const findMedication =
      overrides?.findMedication ?? jest.fn().mockResolvedValue(null);
    const findManyMedications =
      overrides?.findManyMedications ?? jest.fn().mockResolvedValue([]);
    const createMedication =
      overrides?.createMedication ??
      jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'med-1', ...data }),
      );
    const updateMedication =
      overrides?.updateMedication ??
      jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'med-1', ...data }),
      );
    const findPatient =
      overrides?.findPatient ??
      jest.fn().mockResolvedValue({ id: 'patient-1', createdById: 'medico-1' });
    const auditLog = overrides?.auditLog ?? jest.fn().mockResolvedValue(undefined);

    const prisma = {
      patient: { findUnique: findPatient },
      patientMedication: {
        findUnique: findMedication,
        findMany: findManyMedications,
        create: createMedication,
        update: updateMedication,
      },
    } as never;
    const audit = { log: auditLog } as never;

    return {
      service: new PatientMedicationsService(prisma, audit),
      findMedication,
      findManyMedications,
      createMedication,
      updateMedication,
      findPatient,
      auditLog,
    };
  }

  // ---------------------------------------------------------------------------
  describe('findByPatient', () => {
    it('devuelve medicamentos activos del paciente', async () => {
      const meds = [
        { id: 'med-1', drug: 'Ibuprofeno', status: 'ACTIVO' },
        { id: 'med-2', drug: 'Omeprazol', status: 'SUSPENDIDO' },
      ];
      const { service, findManyMedications } = buildService({
        findManyMedications: jest.fn().mockResolvedValue(meds),
      });

      const result = await service.findByPatient('patient-1', baseUser);

      expect(result).toEqual(meds);
      expect(findManyMedications).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-1', deletedAt: null },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('crea medicamento y registra audit', async () => {
      const { service, createMedication, auditLog } = buildService();
      const dto: any = {
        patientId: 'patient-1',
        drug: 'Metformina',
        dose: '500 mg',
        route: 'Oral',
        frequency: 'Dos veces al día',
      };

      const result = await service.create(dto, baseUser);

      expect(result.id).toBe('med-1');
      expect(createMedication).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            drug: 'Metformina',
            status: 'ACTIVO',
          }),
        }),
      );
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'PatientMedication',
          action: 'CREATE',
          reason: 'MEDICATION_CREATED',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('actualiza medicamento existente y registra audit', async () => {
      const existing = {
        id: 'med-1',
        patientId: 'patient-1',
        drug: 'Ibuprofeno',
        dose: '400 mg',
        route: 'Oral',
        frequency: 'Cada 8 horas',
        status: 'ACTIVO',
        startDate: null,
        notes: null,
        deletedAt: null,
      };
      const { service, updateMedication, auditLog } = buildService({
        findMedication: jest.fn().mockResolvedValue(existing),
      });

      const dto: any = { status: 'SUSPENDIDO' };
      await service.update('med-1', dto, baseUser);

      expect(updateMedication).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'med-1' },
          data: expect.objectContaining({ status: 'SUSPENDIDO' }),
        }),
      );
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'PatientMedication',
          action: 'UPDATE',
          reason: 'MEDICATION_UPDATED',
        }),
      );
    });

    it('lanza NotFoundException si el medicamento no existe', async () => {
      const { service } = buildService({
        findMedication: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update('no-such-id', {}, baseUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza NotFoundException si el medicamento está soft-deleted', async () => {
      const { service } = buildService({
        findMedication: jest
          .fn()
          .mockResolvedValue({ id: 'med-1', patientId: 'p-1', deletedAt: new Date() }),
      });

      await expect(service.update('med-1', {}, baseUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('hace soft-delete del medicamento y registra audit', async () => {
      const existing = {
        id: 'med-1',
        patientId: 'patient-1',
        drug: 'Ibuprofeno',
        deletedAt: null,
      };
      const { service, updateMedication, auditLog } = buildService({
        findMedication: jest.fn().mockResolvedValue(existing),
      });

      const result = await service.remove('med-1', baseUser);

      expect(result).toEqual({ ok: true });
      expect(updateMedication).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'med-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'PatientMedication',
          action: 'DELETE',
          reason: 'MEDICATION_REMOVED',
        }),
      );
    });

    it('lanza NotFoundException si el medicamento no existe', async () => {
      const { service } = buildService({
        findMedication: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('no-such-id', baseUser)).rejects.toThrow(NotFoundException);
    });
  });
});
