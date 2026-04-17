import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';
import { extractDateOnlyIso, parseDateOnlyToStoredUtcDate } from '../common/utils/local-date';
import { isClinicalRecordInMedicoScope } from '../common/utils/patient-access';
import { PrismaService } from '../prisma/prisma.service';
import { formatTask } from './patients-format';

type AssertPatientAccessFn = (user: RequestUser, patientId: string) => Promise<unknown>;

interface CreatePatientTaskInput {
  title: string;
  details?: string;
  type?: string;
  priority?: string;
  status?: string;
  recurrenceRule?: string;
  dueDate?: string;
  encounterId?: string;
}

interface CreatePatientTaskMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  patientId: string;
  dto: CreatePatientTaskInput;
  effectiveMedicoId: string;
  assertPatientAccess: AssertPatientAccessFn;
}

interface UpdatePatientTaskInput {
  title?: string;
  status?: string;
  details?: string;
  type?: string;
  priority?: string;
  recurrenceRule?: string;
  dueDate?: string;
}

function resolveNextRecurringDueDate(currentDueDate: Date, recurrenceRule: string) {
  const dateOnly = extractDateOnlyIso(currentDueDate);
  const [year, month, day] = dateOnly.split('-').map(Number);

  if (recurrenceRule === 'WEEKLY') {
    return parseDateOnlyToStoredUtcDate(
      new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10),
      'La próxima fecha de recurrencia',
    );
  }

  if (recurrenceRule === 'MONTHLY') {
    const candidate = new Date(Date.UTC(year, month, day));
    const normalized = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), Math.min(day, 28)));
    return parseDateOnlyToStoredUtcDate(normalized.toISOString().slice(0, 10), 'La próxima fecha de recurrencia');
  }

  return null;
}

interface UpdatePatientTaskMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  taskId: string;
  dto: UpdatePatientTaskInput;
  effectiveMedicoId: string;
  assertPatientAccess: AssertPatientAccessFn;
}

export async function createPatientTaskMutation(params: CreatePatientTaskMutationParams) {
  const {
    prisma,
    auditService,
    user,
    patientId,
    dto,
    effectiveMedicoId,
    assertPatientAccess,
  } = params;

  await assertPatientAccess(user, patientId);

  let resolvedMedicoId = effectiveMedicoId;

  if (dto.encounterId) {
    const encounter = await prisma.encounter.findFirst({
      where: {
        id: dto.encounterId,
        patientId,
        ...(user.isAdmin ? {} : { medicoId: effectiveMedicoId }),
      },
    });

    if (!encounter) {
      throw new BadRequestException('La atención asociada no existe para este paciente');
    }

    resolvedMedicoId = encounter.medicoId;
  }

  if ((dto.recurrenceRule || 'NONE') !== 'NONE' && !dto.dueDate) {
    throw new BadRequestException('La recurrencia simple requiere fecha de vencimiento');
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.encounterTask.create({
      data: {
        patientId,
        encounterId: dto.encounterId || null,
        createdById: user.id,
        medicoId: resolvedMedicoId,
        title: dto.title.trim(),
        details: dto.details?.trim() || null,
        type: dto.type || 'SEGUIMIENTO',
        priority: dto.priority || 'MEDIA',
        status: dto.status || 'PENDIENTE',
        recurrenceRule: dto.recurrenceRule || 'NONE',
        dueDate: dto.dueDate ? parseDateOnlyToStoredUtcDate(dto.dueDate, 'La fecha de vencimiento') : null,
      },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    await auditService.log(
      {
        entityType: 'EncounterTask',
        entityId: created.id,
        userId: user.id,
        action: 'CREATE',
        diff: { created },
      },
      tx,
    );

    return formatTask(created);
  });
}

export async function updatePatientTaskMutation(params: UpdatePatientTaskMutationParams) {
  const {
    prisma,
    auditService,
    user,
    taskId,
    dto,
    effectiveMedicoId,
    assertPatientAccess,
  } = params;

  const task = await prisma.encounterTask.findUnique({
    where: { id: taskId },
    include: {
      patient: true,
      encounter: {
        select: { medicoId: true },
      },
      createdBy: {
        select: { id: true, nombre: true, medicoId: true },
      },
    },
  });

  if (!task || task.patient.archivedAt) {
    throw new NotFoundException('Seguimiento no encontrado');
  }

  await assertPatientAccess(user, task.patientId);

  if (!user.isAdmin && !isClinicalRecordInMedicoScope(task, effectiveMedicoId)) {
    throw new NotFoundException('Seguimiento no encontrado');
  }

  const nextRecurrenceRule = dto.recurrenceRule || task.recurrenceRule;
  const nextDueDate = dto.dueDate !== undefined ? dto.dueDate : task.dueDate ? extractDateOnlyIso(task.dueDate) : undefined;
  if (nextRecurrenceRule !== 'NONE' && !nextDueDate) {
    throw new BadRequestException('La recurrencia simple requiere fecha de vencimiento');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.encounterTask.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim() || task.title,
        status: dto.status || task.status,
        details: dto.details !== undefined ? dto.details.trim() || null : task.details,
        type: dto.type || task.type,
        priority: dto.priority || task.priority,
        recurrenceRule: dto.recurrenceRule || task.recurrenceRule,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate
              ? parseDateOnlyToStoredUtcDate(dto.dueDate, 'La fecha de vencimiento')
              : null
            : task.dueDate,
        completedAt:
          dto.status === 'COMPLETADA'
            ? new Date()
            : dto.status && dto.status !== 'COMPLETADA'
              ? null
              : task.completedAt,
      },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (
      updated.status === 'COMPLETADA'
      && task.status !== 'COMPLETADA'
      && updated.recurrenceRule !== 'NONE'
      && updated.dueDate
    ) {
      const nextDueDate = resolveNextRecurringDueDate(updated.dueDate, updated.recurrenceRule);
      if (nextDueDate) {
        await tx.encounterTask.create({
          data: {
            patientId: updated.patientId,
            encounterId: updated.encounterId,
            createdById: user.id,
            medicoId: updated.medicoId,
            recurrenceSourceTaskId: task.recurrenceSourceTaskId || updated.id,
            title: updated.title,
            details: updated.details,
            type: updated.type,
            priority: updated.priority,
            status: 'PENDIENTE',
            recurrenceRule: updated.recurrenceRule,
            dueDate: nextDueDate,
          },
        });
      }
    }

    await auditService.log(
      {
        entityType: 'EncounterTask',
        entityId: updated.id,
        userId: user.id,
        action: 'UPDATE',
        diff: { before: task, after: updated },
      },
      tx,
    );

    return formatTask(updated);
  });
}
