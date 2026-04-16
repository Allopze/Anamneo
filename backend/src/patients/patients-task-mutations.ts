import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';
import { isClinicalRecordInMedicoScope } from '../common/utils/patient-access';
import { parseDateOnlyToStoredUtcDate } from '../common/utils/local-date';
import { PrismaService } from '../prisma/prisma.service';
import { formatTask } from './patients-format';

type AssertPatientAccessFn = (user: RequestUser, patientId: string) => Promise<unknown>;

interface CreatePatientTaskInput {
  title: string;
  details?: string;
  type?: string;
  priority?: string;
  status?: string;
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
  dueDate?: string;
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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.encounterTask.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim() || task.title,
        status: dto.status || task.status,
        details: dto.details !== undefined ? dto.details.trim() || null : task.details,
        type: dto.type || task.type,
        priority: dto.priority || task.priority,
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
