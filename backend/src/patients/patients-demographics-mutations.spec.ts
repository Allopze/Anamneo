import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  updatePatientAdminDemographicsMutation,
  updatePatientDemographicsMutation,
} from './patients-demographics-mutations';
import { RequestUser } from '../common/utils/medico-id';

describe('patients-demographics-mutations', () => {
  const medicoUser: RequestUser = {
    id: 'med-1',
    role: 'MEDICO',
    isAdmin: false,
  };

  const adminUser: RequestUser = {
    id: 'admin-1',
    role: 'ADMIN',
    isAdmin: true,
  };

  function buildExistingPatient() {
    return {
      id: 'patient-1',
      createdById: 'med-1',
      createdBy: { medicoId: 'med-1' },
      archivedAt: null,
      rut: '11.111.111-1',
      rutExempt: false,
      rutExemptReason: null,
      nombre: 'Paciente Demo',
      fechaNacimiento: new Date('1990-05-10T00:00:00.000Z'),
      edad: 34,
      edadMeses: null,
      sexo: 'MASCULINO',
      prevision: 'FONASA',
      trabajo: 'Trabajo anterior',
      domicilio: 'Domicilio anterior',
      completenessStatus: 'VERIFICADA',
      demographicsVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      demographicsVerifiedById: 'med-1',
      history: { id: 'history-1' },
    };
  }

  it('rejects demographic updates with a future birth date', async () => {
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(buildExistingPatient()),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const auditService = { log: jest.fn() };
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await expect(
      updatePatientDemographicsMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        id: 'patient-1',
        updatePatientDto: { fechaNacimiento: tomorrow },
        user: medicoUser,
        effectiveMedicoId: 'med-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.patient.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('rejects updates when the new RUT already exists in another patient', async () => {
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(buildExistingPatient()),
        findFirst: jest.fn().mockResolvedValue({ id: 'patient-2' }),
        update: jest.fn(),
      },
    };
    const auditService = { log: jest.fn() };

    await expect(
      updatePatientDemographicsMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        id: 'patient-1',
        updatePatientDto: { rut: '12.345.678-5' },
        user: medicoUser,
        effectiveMedicoId: 'med-1',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.patient.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('updates demographics and emits an audit record on success', async () => {
    const existingPatient = buildExistingPatient();
    const updatedPatient = {
      ...existingPatient,
      nombre: 'Nombre Actualizado',
      rut: '12.345.678-5',
    };

    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(existingPatient),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(updatedPatient),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const result = await updatePatientDemographicsMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      id: 'patient-1',
      updatePatientDto: {
        nombre: '  Nombre Actualizado  ',
        rut: '12.345.678-5',
      },
      user: medicoUser,
      effectiveMedicoId: 'med-1',
    });

    expect(result).toBe(updatedPatient);
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'patient-1' },
        include: { history: true },
        data: expect.objectContaining({
          nombre: 'Nombre Actualizado',
          rut: '12.345.678-5',
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Patient',
        entityId: 'patient-1',
        action: 'UPDATE',
      }),
    );
  });

  it('updates admin demographic fields and logs ADMIN_FIELDS scope', async () => {
    const existingPatient = buildExistingPatient();
    const updatedPatient = {
      ...existingPatient,
      trabajo: null,
      domicilio: 'Calle Nueva 123',
    };

    const prisma = {
      patient: {
        update: jest.fn().mockResolvedValue(updatedPatient),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const assertPatientAccess = jest.fn().mockResolvedValue(existingPatient);

    const result = await updatePatientAdminDemographicsMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      patientId: 'patient-1',
      dto: {
        trabajo: '   ',
        domicilio: '  Calle Nueva 123  ',
      },
      user: adminUser,
      assertPatientAccess,
    });

    expect(result).toBe(updatedPatient);
    expect(assertPatientAccess).toHaveBeenCalledWith(adminUser, 'patient-1');
    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'patient-1' },
        include: { history: true },
        data: expect.objectContaining({
          trabajo: null,
          domicilio: 'Calle Nueva 123',
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          scope: 'ADMIN_FIELDS',
        }),
      }),
    );
  });
});