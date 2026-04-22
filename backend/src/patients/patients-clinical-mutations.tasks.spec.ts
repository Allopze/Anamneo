import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  createPatientTaskMutation,
  updatePatientTaskMutation,
} from './patients-clinical-mutations';
import { medicoUser, buildTaskInScope } from './patients-clinical-mutations.spec.helpers';

describe('patients-clinical-mutations task operations', () => {
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

  it('allows clearing dueDate while changing recurrenceRule to NONE', async () => {
    const existingTask = {
      ...buildTaskInScope('med-1'),
      dueDate: new Date('2026-02-01T12:00:00.000Z'),
      recurrenceRule: 'WEEKLY',
    };
    const updatedTask = {
      ...existingTask,
      recurrenceRule: 'NONE',
      dueDate: null,
      updatedAt: new Date('2026-02-01T15:00:00.000Z'),
      createdBy: { id: 'med-1', nombre: 'Dra. Demo' },
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
        recurrenceRule: 'NONE',
        dueDate: null,
      },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    expect(tx.encounterTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recurrenceRule: 'NONE',
          dueDate: null,
        }),
      }),
    );
    expect(result.recurrenceRule).toBe('NONE');
    expect(result.dueDate).toBeNull();
  });

  it('creates the next recurring task when a recurring follow-up is completed', async () => {
    const existingTask = {
      ...buildTaskInScope('med-1'),
      dueDate: new Date('2026-02-01T12:00:00.000Z'),
      recurrenceRule: 'WEEKLY',
    };
    const updatedTask = {
      ...existingTask,
      status: 'COMPLETADA',
      completedAt: new Date('2026-02-01T15:00:00.000Z'),
      updatedAt: new Date('2026-02-01T15:00:00.000Z'),
      createdBy: { id: 'med-1', nombre: 'Dra. Demo' },
    };

    const tx = {
      encounterTask: {
        update: jest.fn().mockResolvedValue(updatedTask),
        create: jest.fn().mockResolvedValue({ id: 'task-2' }),
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

    await updatePatientTaskMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      user: medicoUser,
      taskId: 'task-1',
      dto: { status: 'COMPLETADA' },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    expect(tx.encounterTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recurrenceSourceTaskId: 'task-1',
          recurrenceRule: 'WEEKLY',
          status: 'PENDIENTE',
          dueDate: expect.any(Date),
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'EncounterTask',
        entityId: 'task-2',
        action: 'CREATE',
      }),
      tx,
    );
  });

  it('uses the last available day of the next month for monthly recurring tasks anchored on the 31st', async () => {
    const existingTask = {
      ...buildTaskInScope('med-1'),
      dueDate: new Date('2026-01-31T12:00:00.000Z'),
      recurrenceRule: 'MONTHLY',
    };
    const updatedTask = {
      ...existingTask,
      status: 'COMPLETADA',
      completedAt: new Date('2026-01-31T15:00:00.000Z'),
      updatedAt: new Date('2026-01-31T15:00:00.000Z'),
      createdBy: { id: 'med-1', nombre: 'Dra. Demo' },
    };

    const tx = {
      encounterTask: {
        update: jest.fn().mockResolvedValue(updatedTask),
        create: jest.fn().mockResolvedValue({ id: 'task-2' }),
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

    await updatePatientTaskMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      user: medicoUser,
      taskId: 'task-1',
      dto: { status: 'COMPLETADA' },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    const createdPayload = tx.encounterTask.create.mock.calls[0][0].data;
    expect(createdPayload.recurrenceRule).toBe('MONTHLY');
    expect(createdPayload.recurrenceSourceTaskId).toBe('task-1');
    expect(createdPayload.dueDate.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('preserves the original monthly anchor day after a short month', async () => {
    const existingTask = {
      ...buildTaskInScope('med-1'),
      dueDate: new Date('2026-02-28T12:00:00.000Z'),
      recurrenceRule: 'MONTHLY',
      recurrenceSourceTaskId: 'task-root',
    };
    const updatedTask = {
      ...existingTask,
      status: 'COMPLETADA',
      completedAt: new Date('2026-02-28T15:00:00.000Z'),
      updatedAt: new Date('2026-02-28T15:00:00.000Z'),
      createdBy: { id: 'med-1', nombre: 'Dra. Demo' },
    };

    const tx = {
      encounterTask: {
        findUnique: jest.fn().mockResolvedValue({ dueDate: new Date('2026-01-31T12:00:00.000Z') }),
        update: jest.fn().mockResolvedValue(updatedTask),
        create: jest.fn().mockResolvedValue({ id: 'task-3' }),
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

    await updatePatientTaskMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      user: medicoUser,
      taskId: 'task-1',
      dto: { status: 'COMPLETADA' },
      effectiveMedicoId: 'med-1',
      assertPatientAccess,
    });

    expect(tx.encounterTask.findUnique).toHaveBeenCalledWith({
      where: { id: 'task-root' },
      select: { dueDate: true },
    });

    const createdPayload = tx.encounterTask.create.mock.calls[0][0].data;
    expect(createdPayload.recurrenceRule).toBe('MONTHLY');
    expect(createdPayload.recurrenceSourceTaskId).toBe('task-root');
    expect(createdPayload.dueDate.toISOString().slice(0, 10)).toBe('2026-03-31');
  });
});