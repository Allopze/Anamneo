import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';
import { getPatientDemographicsMissingFields } from '../common/utils/patient-completeness';
import { PATIENT_HISTORY_FIELD_KEYS, sanitizePatientHistoryFieldValue } from '../common/utils/patient-history';
import { isPatientOwnedByMedico } from '../common/utils/patient-access';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { resolvePatientVerificationState } from './patients-format';

type AssertPatientAccessFn = (user: RequestUser, patientId: string) => Promise<any>;

interface VerifyPatientDemographicsParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  patientId: string;
  assertPatientAccess: AssertPatientAccessFn;
}

interface UpdatePatientHistoryParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  patientId: string;
  dto: UpdatePatientHistoryDto;
  assertPatientAccess: AssertPatientAccessFn;
}

interface ArchivePatientParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  user: RequestUser;
  effectiveMedicoId: string;
}

interface RestorePatientParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  user: RequestUser;
  effectiveMedicoId: string;
}

export async function verifyPatientDemographicsMutation(params: VerifyPatientDemographicsParams) {
  const { prisma, auditService, user, patientId, assertPatientAccess } = params;
  const patient = await assertPatientAccess(user, patientId);

  const missingFields = getPatientDemographicsMissingFields(patient);
  if (missingFields.length > 0) {
    throw new BadRequestException('No se puede verificar una ficha con datos demográficos incompletos');
  }

  return prisma.$transaction(async (tx) => {
    const updatedPatient = await tx.patient.update({
      where: { id: patientId },
      data: resolvePatientVerificationState({
        currentPatient: patient,
        nextPatient: patient,
        actorId: user.id,
        actorRole: user.role,
        mode: 'VERIFY',
      }),
      include: { history: true },
    });

    await auditService.log(
      {
        entityType: 'Patient',
        entityId: updatedPatient.id,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          before: patient,
          after: updatedPatient,
          scope: 'VERIFY_DEMOGRAPHICS',
        },
      },
      tx,
    );

    return updatedPatient;
  });
}

export async function updatePatientHistoryMutation(params: UpdatePatientHistoryParams) {
  const { prisma, auditService, user, patientId, dto, assertPatientAccess } = params;
  const patient = await assertPatientAccess(user, patientId);
  const dtoRecord = dto as Record<string, unknown>;

  const previousHistory = patient.history;

  const historyData: Record<string, string | null> = {};
  for (const key of PATIENT_HISTORY_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(dtoRecord, key)) {
      continue;
    }

    const sanitized = sanitizePatientHistoryFieldValue(key, dtoRecord[key], {
      rejectUnknownKeys: true,
    });

    historyData[key] = sanitized ? JSON.stringify(sanitized) : null;
  }

  return prisma.$transaction(async (tx) => {
    const history = await tx.patientHistory.upsert({
      where: { patientId },
      update: historyData,
      create: {
        patientId,
        ...historyData,
      },
    });

    await auditService.log(
      {
        entityType: 'PatientHistory',
        entityId: history.id,
        userId: user.id,
        action: previousHistory ? 'UPDATE' : 'CREATE',
        diff: {
          before: previousHistory,
          after: history,
        },
      },
      tx,
    );

    return history;
  });
}

export async function archivePatientMutation(params: ArchivePatientParams) {
  const {
    prisma,
    auditService,
    id,
    user,
    effectiveMedicoId,
  } = params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { medicoId: true },
      },
    },
  });

  if (!patient) {
    throw new NotFoundException('Paciente no encontrado');
  }

  if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
    throw new ForbiddenException('No tiene permisos para archivar este paciente');
  }

  if (patient.archivedAt) {
    return { message: 'El paciente ya se encuentra archivado' };
  }

  const archivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.encounter.updateMany({
      where: {
        patientId: id,
        status: 'EN_PROGRESO',
      },
      data: {
        status: 'CANCELADO',
      },
    });

    await tx.patient.update({
      where: { id },
      data: {
        archivedAt,
        archivedById: user.id,
      },
    });

    await auditService.log(
      {
        entityType: 'Patient',
        entityId: id,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          archivedAt: archivedAt.toISOString(),
          archivedById: user.id,
          previousStatus: patient,
        },
      },
      tx,
    );
  });

  return { message: 'Paciente archivado correctamente' };
}

export async function restorePatientMutation(params: RestorePatientParams) {
  const {
    prisma,
    auditService,
    id,
    user,
    effectiveMedicoId,
  } = params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { medicoId: true },
      },
    },
  });

  if (!patient) {
    throw new NotFoundException('Paciente no encontrado');
  }

  if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
    throw new ForbiddenException('No tiene permisos para restaurar este paciente');
  }

  if (!patient.archivedAt) {
    return { message: 'El paciente ya se encuentra activo' };
  }

  const previousArchivedAt = patient.archivedAt;

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id },
      data: {
        archivedAt: null,
        archivedById: null,
      },
    });

    await auditService.log(
      {
        entityType: 'Patient',
        entityId: id,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          restoredAt: new Date().toISOString(),
          previousArchivedAt: previousArchivedAt.toISOString(),
          previousArchivedById: patient.archivedById,
        },
      },
      tx,
    );
  });

  return { message: 'Paciente restaurado correctamente' };
}
