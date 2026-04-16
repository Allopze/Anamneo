import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';
import { isClinicalRecordInMedicoScope } from '../common/utils/patient-access';
import { parseDateOnlyToStoredUtcDate } from '../common/utils/local-date';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';
import { UpsertPatientProblemDto } from './dto/upsert-patient-problem.dto';
import { formatProblem } from './patients-format';

type AssertPatientAccessFn = (user: RequestUser, patientId: string) => Promise<unknown>;

interface CreatePatientProblemMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  patientId: string;
  dto: UpsertPatientProblemDto;
  effectiveMedicoId: string;
  assertPatientAccess: AssertPatientAccessFn;
}

interface UpdatePatientProblemMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  problemId: string;
  dto: UpdatePatientProblemDto;
  effectiveMedicoId: string;
  assertPatientAccess: AssertPatientAccessFn;
}

export async function createPatientProblemMutation(params: CreatePatientProblemMutationParams) {
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

  const created = await prisma.patientProblem.create({
    data: {
      patientId,
      encounterId: dto.encounterId || null,
      createdById: user.id,
      medicoId: resolvedMedicoId,
      label: dto.label.trim(),
      status: dto.status || 'ACTIVO',
      notes: dto.notes?.trim() || null,
      severity: dto.severity?.trim() || null,
      onsetDate: dto.onsetDate ? parseDateOnlyToStoredUtcDate(dto.onsetDate, 'La fecha de inicio') : null,
    },
    include: {
      encounter: {
        select: { id: true, createdAt: true, status: true },
      },
      createdBy: {
        select: { id: true, nombre: true },
      },
    },
  });

  await auditService.log({
    entityType: 'PatientProblem',
    entityId: created.id,
    userId: user.id,
    action: 'CREATE',
    diff: { created },
  });

  return formatProblem(created);
}

export async function updatePatientProblemMutation(params: UpdatePatientProblemMutationParams) {
  const {
    prisma,
    auditService,
    user,
    problemId,
    dto,
    effectiveMedicoId,
    assertPatientAccess,
  } = params;

  const problem = await prisma.patientProblem.findUnique({
    where: { id: problemId },
    include: {
      patient: true,
      encounter: {
        select: { id: true, createdAt: true, status: true, medicoId: true },
      },
      createdBy: {
        select: { medicoId: true },
      },
    },
  });

  if (!problem || problem.patient.archivedAt) {
    throw new NotFoundException('Problema clínico no encontrado');
  }

  await assertPatientAccess(user, problem.patientId);

  if (!user.isAdmin && !isClinicalRecordInMedicoScope(problem, effectiveMedicoId)) {
    throw new NotFoundException('Problema clínico no encontrado');
  }

  const updated = await prisma.patientProblem.update({
    where: { id: problemId },
    data: {
      label: dto.label?.trim() || problem.label,
      status: dto.status || problem.status,
      notes: dto.notes !== undefined ? dto.notes.trim() || null : problem.notes,
      severity: dto.severity !== undefined ? dto.severity.trim() || null : problem.severity,
      onsetDate:
        dto.onsetDate !== undefined
          ? dto.onsetDate
            ? parseDateOnlyToStoredUtcDate(dto.onsetDate, 'La fecha de inicio')
            : null
          : problem.onsetDate,
      resolvedAt: dto.status === 'RESUELTO' ? new Date() : dto.status ? null : problem.resolvedAt,
    },
    include: {
      encounter: {
        select: { id: true, createdAt: true, status: true },
      },
      createdBy: {
        select: { id: true, nombre: true },
      },
    },
  });

  await auditService.log({
    entityType: 'PatientProblem',
    entityId: updated.id,
    userId: user.id,
    action: 'UPDATE',
    diff: { before: problem, after: updated },
  });

  return formatProblem(updated);
}
