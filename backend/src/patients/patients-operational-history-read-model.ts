import { AUDIT_REASON_LABELS } from '../audit/audit-catalog';
import { PrismaService } from '../prisma/prisma.service';

type OperationalReason =
  | 'PATIENT_ARCHIVED'
  | 'PATIENT_RESTORED'
  | 'ENCOUNTER_CANCELLED'
  | 'ENCOUNTER_REOPENED';

export interface PatientOperationalHistoryItem {
  id: string;
  timestamp: Date;
  reason: OperationalReason;
  label: string;
  detail: string | null;
  userName: string;
  encounterId: string | null;
  encounterCreatedAt: Date | null;
}

interface PatientOperationalHistoryReadModelParams {
  prisma: PrismaService;
  patientId: string;
  effectiveMedicoId: string;
  limit: number;
}

function parseAuditDiff(diff: string | null): Record<string, unknown> {
  if (!diff) {
    return {};
  }

  try {
    const parsed = JSON.parse(diff) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getCountValue(diff: Record<string, unknown>, key: string) {
  const value = diff[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildOperationalDetail(params: {
  reason: OperationalReason;
  diff: Record<string, unknown>;
  encounterCreatedAt: Date | null;
}) {
  const { reason, diff, encounterCreatedAt } = params;

  if (reason === 'PATIENT_ARCHIVED') {
    const cancelledCount = getCountValue(diff, 'autoCancelledEncounterCount');
    return cancelledCount > 0
      ? `Se cancelaron ${cancelledCount} atenciones en progreso asociadas a esta ficha.`
      : 'No había atenciones en progreso asociadas a esta ficha.';
  }

  if (reason === 'PATIENT_RESTORED') {
    const restoredCount = getCountValue(diff, 'restoredEncounterCount');
    return restoredCount > 0
      ? `Se reabrieron ${restoredCount} atenciones que habían sido canceladas por el archivado.`
      : 'La ficha volvió a estado activo sin reaperturas pendientes.';
  }

  if (reason === 'ENCOUNTER_CANCELLED') {
    const scope = diff.scope;
    if (scope === 'PATIENT_ARCHIVE') {
      return 'La atención se canceló automáticamente porque la ficha del paciente fue archivada.';
    }

    return encounterCreatedAt
      ? 'La atención quedó cancelada y salió del flujo clínico activo.'
      : 'La atención fue cancelada.';
  }

  const scope = diff.scope;
  if (scope === 'PATIENT_RESTORE') {
    return 'La atención volvió a estado en progreso al restaurar la ficha del paciente.';
  }

  const reasonCode = typeof diff.reasonCode === 'string' ? diff.reasonCode : null;
  return reasonCode
    ? `La atención volvió a edición clínica con motivo ${reasonCode.toLowerCase().replaceAll('_', ' ')}.`
    : 'La atención volvió a estado en progreso.';
}

export async function getPatientOperationalHistoryReadModel(
  params: PatientOperationalHistoryReadModelParams,
) {
  const { prisma, patientId, effectiveMedicoId, limit } = params;

  const encounters = await prisma.encounter.findMany({
    where: {
      patientId,
      medicoId: effectiveMedicoId,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  const encounterMap = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  const encounterIds = encounters.map((encounter) => encounter.id);

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        {
          entityType: 'PatientArchive',
          entityId: patientId,
        },
        {
          entityType: 'PatientRestore',
          entityId: patientId,
        },
        ...(encounterIds.length > 0
          ? [
              {
                entityType: 'Encounter',
                entityId: { in: encounterIds },
                reason: {
                  in: ['ENCOUNTER_CANCELLED', 'ENCOUNTER_REOPENED'],
                },
              },
            ]
          : []),
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  const userIds = [...new Set(logs.map((log) => log.userId))];
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nombre: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user.nombre]));

  return logs.map((log) => {
    const reason = log.reason as OperationalReason;
    const diff = parseAuditDiff(log.diff);
    const encounter = encounterMap.get(log.entityType === 'Encounter' ? log.entityId : '');

    return {
      id: log.id,
      timestamp: log.timestamp,
      reason,
      label: AUDIT_REASON_LABELS[reason],
      detail: buildOperationalDetail({
        reason,
        diff,
        encounterCreatedAt: encounter?.createdAt ?? null,
      }),
      userName: userMap.get(log.userId) ?? 'Sistema',
      encounterId: encounter?.id ?? null,
      encounterCreatedAt: encounter?.createdAt ?? null,
    } satisfies PatientOperationalHistoryItem;
  });
}
