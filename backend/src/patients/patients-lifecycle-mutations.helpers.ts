import { ForbiddenException } from '@nestjs/common';
import type { Patient } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isPatientOwnedByMedico } from '../common/utils/patient-access';
import type { RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';

export function parseAutoCancelledEncounterIds(diff: string | null): string[] {
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

interface ExecuteArchivePatientParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  id: string;
  patient: Patient;
}

interface ExecuteRestorePatientParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  id: string;
  patient: Patient;
}

export async function executeArchivePatientMutation(params: ExecuteArchivePatientParams) {
  const { prisma, auditService, user, id, patient } = params;

  let autoCancelledEncounterCount = 0;
  await prisma.$transaction(async (tx) => {
    const encountersToCancel = await tx.encounter.findMany({
      where: {
        patientId: id,
        status: 'EN_PROGRESO',
      },
      select: { id: true, status: true },
    });

    if (encountersToCancel.length > 0) {
      autoCancelledEncounterCount = encountersToCancel.length;
      await tx.encounter.updateMany({
        where: { id: { in: encountersToCancel.map((encounter) => encounter.id) } },
        data: { status: 'CANCELADO' },
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
        archivedAt: new Date(),
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
          archivedAt: new Date().toISOString(),
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
          archivedAt: new Date().toISOString(),
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

export async function executeRestorePatientMutation(params: ExecuteRestorePatientParams) {
  const { prisma, auditService, user, id, patient } = params;

  const latestArchiveAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: 'PatientArchive',
      entityId: id,
    },
    orderBy: { timestamp: 'desc' },
    select: { diff: true },
  });

  const autoCancelledEncounterIds = parseAutoCancelledEncounterIds(latestArchiveAudit?.diff ?? null);
  const encountersToRestore = autoCancelledEncounterIds.length > 0
    ? await prisma.encounter.findMany({
        where: {
          id: { in: autoCancelledEncounterIds },
          patientId: id,
          status: 'CANCELADO',
        },
        select: { id: true, status: true },
      })
    : [];

  let restoredEncounterCount = 0;
  await prisma.$transaction(async (tx) => {
    if (encountersToRestore.length > 0) {
      restoredEncounterCount = encountersToRestore.length;
      await tx.encounter.updateMany({
        where: { id: { in: encountersToRestore.map((encounter) => encounter.id) } },
        data: { status: 'EN_PROGRESO' },
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
          previousArchivedAt: patient.archivedAt?.toISOString() ?? null,
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

export function assertPatientCanArchiveOrRestore(
  user: RequestUser,
  patient: Patient,
  effectiveMedicoId: string,
) {
  if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
    throw new ForbiddenException('No tiene permisos para modificar el estado de este paciente');
  }
}
