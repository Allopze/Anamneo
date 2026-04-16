import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  createPatientProblemMutation,
  createPatientTaskMutation,
  updatePatientTaskMutation,
  updatePatientProblemMutation,
} from './patients-clinical-mutations';
import { RequestUser } from '../common/utils/medico-id';

describe('patients-clinical-mutations', () => {
  const medicoUser: RequestUser = {
    id: 'med-1',
    role: 'MEDICO',
    isAdmin: false,
  };

  function buildTaskInScope(medicoId: string) {
    return {
      id: 'task-1',
      patientId: 'patient-1',
      encounterId: 'enc-1',
      createdById: 'med-1',
      medicoId,
      title: 'Seguimiento inicial',
      details: null,
      type: 'SEGUIMIENTO',
      priority: 'MEDIA',
      status: 'PENDIENTE',
      dueDate: null,
      completedAt: null,
      createdAt: new Date('2026-01-10T12:00:00.000Z'),
      updatedAt: new Date('2026-01-10T12:00:00.000Z'),
      patient: { archivedAt: null },
      encounter: { medicoId },
      createdBy: { id: 'med-1', nombre: 'Dra. Demo', medicoId },
    };
  }

  it('rejects creating a problem when encounter does not belong to the patient scope', async () => {
    const prisma = {
      encounter: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      patientProblem: {
        create: jest.fn(),
      },
    };
    const auditService = { log: jest.fn() };
    const assertPatientAccess = jest.fn().mockResolvedValue({ id: 'patient-1' });

    await expect(
      createPatientProblemMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        user: medicoUser,
        patientId: 'patient-1',
        dto: {
          label: 'Hipertensión',
          encounterId: 'enc-1',
        },
        effectiveMedicoId: 'med-1',
        assertPatientAccess,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.patientProblem.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('creates a scoped problem and logs audit metadata', async () => {
    const createdProblem = {
      id: 'problem-1',
      patientId: 'patient-1',
      encounterId: 'enc-1',
      createdById: 'med-1',
      medicoId: 'med-2',
      label: 'Hipertensión',
      status: 'ACTIVO',
      notes: 'En control',
      severity: 'Moderada',
      onsetDate: new Date('2026-01-15T00:00:00.000Z'),
      resolvedAt: null,
      createdAt: new Date('2026-01-15T13:00:00.000Z'),
      updatedAt: new Date('2026-01-15T13:00:00.000Z'),
      encounter: {
        id: 'enc-1',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        status: 'EN_PROGRESO',
      },
      createdBy: {
        id: 'med-1',
        nombre: 'Dra. Demo',
      },
    };

    const tx = {
      patientProblem: {
        create: jest.fn().mockResolvedValue(createdProblem),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      encounter: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enc-1',
          patientId: 'patient-1',
          medicoId: 'med-2',
        }),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const assertPatientAccess = jest.fn().mockResolvedValue({ id: 'patient-1' });

    const result = await createPatientProblemMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      user: medicoUser,
      patientId: 'patient-1',
      dto: {
        label: '  Hipertensión  ',
        notes: '  En control  ',
        severity: '  Moderada  ',
        onsetDate: '2026-01-15',
        encounterId: 'enc-1',
      },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    expect(tx.patientProblem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'patient-1',
          medicoId: 'med-2',
          label: 'Hipertensión',
          notes: 'En control',
          severity: 'Moderada',
          onsetDate: expect.any(Date),
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientProblem',
        entityId: 'problem-1',
        action: 'CREATE',
      }),
      tx,
    );
    expect(result.label).toBe('Hipertensión');
    expect(result.medicoId).toBe('med-2');
  });

  it('creates a task and logs audit metadata within the same transaction', async () => {
    const createdTask = {
      id: 'task-1',
      patientId: 'patient-1',
      encounterId: null,
      createdById: 'med-1',
      medicoId: 'med-1',
      title: 'Control en 7 días',
      details: null,
      type: 'SEGUIMIENTO',
      priority: 'MEDIA',
      status: 'PENDIENTE',
      dueDate: null,
      completedAt: null,
      createdAt: new Date('2026-01-15T13:00:00.000Z'),
      updatedAt: new Date('2026-01-15T13:00:00.000Z'),
      createdBy: {
        id: 'med-1',
        nombre: 'Dra. Demo',
      },
    };

    const tx = {
      encounterTask: {
        create: jest.fn().mockResolvedValue(createdTask),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const assertPatientAccess = jest.fn().mockResolvedValue({ id: 'patient-1' });

    const result = await createPatientTaskMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      user: medicoUser,
      patientId: 'patient-1',
      dto: {
        title: '  Control en 7 días  ',
      },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.encounterTask.create).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'EncounterTask',
        entityId: 'task-1',
        action: 'CREATE',
      }),
      tx,
    );
    expect(result.title).toBe('Control en 7 días');
  });

  it('hides out-of-scope tasks for non-admin users', async () => {
    const prisma = {
      encounterTask: {
        findUnique: jest.fn().mockResolvedValue(buildTaskInScope('med-2')),
        update: jest.fn(),
      },
    };
    const auditService = { log: jest.fn() };
    const assertPatientAccess = jest.fn().mockResolvedValue({ id: 'patient-1' });

    await expect(
      updatePatientTaskMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        user: medicoUser,
        taskId: 'task-1',
        dto: { status: 'COMPLETADA' },
        effectiveMedicoId: 'med-1',
        assertPatientAccess,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.encounterTask.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('marks a task as completed and logs an update audit event', async () => {
    const existingTask = buildTaskInScope('med-1');
    const updatedTask = {
      ...existingTask,
      title: 'Nuevo seguimiento',
      status: 'COMPLETADA',
      details: 'Listo para control',
      dueDate: new Date('2026-02-01T00:00:00.000Z'),
      completedAt: new Date('2026-01-20T10:00:00.000Z'),
      updatedAt: new Date('2026-01-20T10:00:00.000Z'),
      createdBy: {
        id: 'med-1',
        nombre: 'Dra. Demo',
      },
    };

    const tx = {
      encounterTask: {
        update: jest.fn().mockResolvedValue(updatedTask),
      },
    };

    const prisma = {
      encounterTask: {
        findUnique: jest.fn().mockResolvedValue(existingTask),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const assertPatientAccess = jest.fn().mockResolvedValue({ id: 'patient-1' });

    const result = await updatePatientTaskMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      user: medicoUser,
      taskId: 'task-1',
      dto: {
        title: '  Nuevo seguimiento  ',
        details: '  Listo para control  ',
        status: 'COMPLETADA',
        dueDate: '2026-02-01',
      },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    expect(tx.encounterTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          title: 'Nuevo seguimiento',
          details: 'Listo para control',
          status: 'COMPLETADA',
          dueDate: expect.any(Date),
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'EncounterTask',
        entityId: 'task-1',
        action: 'UPDATE',
      }),
      tx,
    );
    expect(result.status).toBe('COMPLETADA');
    expect(result.title).toBe('Nuevo seguimiento');
  });

  it('updates a problem and logs audit metadata within the same transaction', async () => {
    const existingProblem = {
      id: 'problem-1',
      patientId: 'patient-1',
      encounterId: 'enc-1',
      createdById: 'med-1',
      medicoId: 'med-1',
      label: 'Hipertensión',
      status: 'ACTIVO',
      notes: null,
      severity: null,
      onsetDate: null,
      resolvedAt: null,
      createdAt: new Date('2026-01-15T13:00:00.000Z'),
      updatedAt: new Date('2026-01-15T13:00:00.000Z'),
      patient: { archivedAt: null },
      encounter: { id: 'enc-1', createdAt: new Date('2026-01-15T10:00:00.000Z'), status: 'EN_PROGRESO', medicoId: 'med-1' },
      createdBy: { medicoId: 'med-1' },
    };

    const updatedProblem = {
      ...existingProblem,
      status: 'RESUELTO',
      resolvedAt: new Date('2026-01-20T10:00:00.000Z'),
      createdBy: { id: 'med-1', nombre: 'Dra. Demo' },
    };

    const tx = {
      patientProblem: {
        update: jest.fn().mockResolvedValue(updatedProblem),
      },
    };

    const prisma = {
      patientProblem: {
        findUnique: jest.fn().mockResolvedValue(existingProblem),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const assertPatientAccess = jest.fn().mockResolvedValue({ id: 'patient-1' });

    const result = await updatePatientProblemMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      user: medicoUser,
      problemId: 'problem-1',
      dto: {
        status: 'RESUELTO',
      },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.patientProblem.update).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientProblem',
        entityId: 'problem-1',
        action: 'UPDATE',
      }),
      tx,
    );
    expect(result.status).toBe('RESUELTO');
  });
});