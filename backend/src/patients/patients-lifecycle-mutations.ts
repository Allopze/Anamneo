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

function parseAutoCancelledEncounterIds(diff: string | null): string[] {
  if (!diff) {
    return [];
  }

  try {
    const parsed = JSON.parse(diff) as { autoCancelledEncounterIds?: unknown };
    return Array.isArray(parsed.autoCancelledEncounterIds)
      ? parsed.autoCancelledEncounterIds.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

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
  let autoCancelledEncounterCount = 0;
  await prisma.$transaction(async (tx) => {
    const encountersToCancel = await tx.encounter.findMany({
      where: {
        patientId: id,
        status: 'EN_PROGRESO',
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (encountersToCancel.length > 0) {
      autoCancelledEncounterCount = encountersToCancel.length;
      await tx.encounter.updateMany({
        where: {
          id: {
            in: encountersToCancel.map((encounter) => encounter.id),
          },
        },
        data: {
          status: 'CANCELADO',
        },
      });

      for (const encounter of encountersToCancel) {
        await auditService.log(
          {
            entityType: 'Encounter',
            entityId: encounter.id,
            userId: user.id,
            action: 'UPDATE',
            diff: {
              status: 'CANCELADO',
              previousStatus: encounter.status,
              scope: 'PATIENT_ARCHIVE',
            },
          },
          tx,
        );
      }
    }

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
          autoCancelledEncounterIds: encountersToCancel.map((encounter) => encounter.id),
          autoCancelledEncounterCount: encountersToCancel.length,
          previousStatus: patient,
        },
      },
      tx,
    );

    await auditService.log(
      {
        entityType: 'PatientArchive',
        entityId: id,
        userId: user.id,
        action: 'DELETE',
        diff: {
          archivedAt: archivedAt.toISOString(),
          archivedById: user.id,
          autoCancelledEncounterIds: encountersToCancel.map((encounter) => encounter.id),
          autoCancelledEncounterCount: encountersToCancel.length,
        },
      },
      tx,
    );
  });

  return {
    message: 'Paciente archivado correctamente',
    autoCancelledEncounterCount,
  };
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
  let restoredEncounterCount = 0;

  await prisma.$transaction(async (tx) => {
    const latestArchiveAudit = await tx.auditLog.findFirst({
      where: {
        entityType: 'PatientArchive',
        entityId: id,
      },
      orderBy: { timestamp: 'desc' },
      select: {
        diff: true,
      },
    });
    const autoCancelledEncounterIds = parseAutoCancelledEncounterIds(latestArchiveAudit?.diff ?? null);
    const encountersToRestore = autoCancelledEncounterIds.length > 0
      ? await tx.encounter.findMany({
          where: {
            id: { in: autoCancelledEncounterIds },
            patientId: id,
            status: 'CANCELADO',
          },
          select: {
            id: true,
            status: true,
          },
        })
      : [];

    if (encountersToRestore.length > 0) {
      restoredEncounterCount = encountersToRestore.length;
      await tx.encounter.updateMany({
        where: {
          id: {
            in: encountersToRestore.map((encounter) => encounter.id),
          },
        },
        data: {
          status: 'EN_PROGRESO',
        },
      });

      for (const encounter of encountersToRestore) {
        await auditService.log(
          {
            entityType: 'Encounter',
            entityId: encounter.id,
            userId: user.id,
            action: 'UPDATE',
            diff: {
              status: 'EN_PROGRESO',
              previousStatus: encounter.status,
              scope: 'PATIENT_RESTORE',
            },
          },
          tx,
        );
      }
    }

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
          restoredEncounterIds: encountersToRestore.map((encounter) => encounter.id),
          restoredEncounterCount: encountersToRestore.length,
        },
      },
      tx,
    );

    await auditService.log(
      {
        entityType: 'PatientRestore',
        entityId: id,
        userId: user.id,
        action: 'CREATE',
        diff: {
          restoredAt: new Date().toISOString(),
          restoredEncounterIds: encountersToRestore.map((encounter) => encounter.id),
          restoredEncounterCount: encountersToRestore.length,
        },
      },
      tx,
    );
  });

  return {
    message: 'Paciente restaurado correctamente',
    restoredEncounterCount,
  };
}
