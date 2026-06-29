import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';

const ALERT_SEVERITY_WEIGHT: Record<string, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  BAJA: 1,
};

export function buildPatientLevelOwnershipWhere(effectiveMedicoId: string) {
  return {
    encounterId: null,
    OR: [
      { createdById: effectiveMedicoId },
      { createdBy: { medicoId: effectiveMedicoId } },
    ],
  };
}

export function isPatientLevelAlertInMedicoScope(
  alert: { createdById: string; createdBy?: { medicoId: string | null } | null },
  effectiveMedicoId: string,
) {
  return alert.createdById === effectiveMedicoId || alert.createdBy?.medicoId === effectiveMedicoId;
}

export async function assertEncounterMatchesPatient(
  prisma: PrismaService,
  encounterId: string,
  patientId: string,
  user: RequestUser,
) {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: { patientId: true, medicoId: true },
  });

  if (!encounter) {
    throw new BadRequestException('La atención indicada no existe');
  }

  if (encounter.patientId !== patientId) {
    throw new BadRequestException('La atención indicada no corresponde al paciente');
  }

  if (!user.isAdmin && encounter.medicoId !== getEffectiveMedicoId(user)) {
    throw new BadRequestException('La atención indicada no existe para este paciente');
  }
}

export function sortAlertsByPriority<T extends { severity: string; createdAt: Date }>(alerts: T[]) {
  return [...alerts].sort((left, right) => {
    const severityDelta = (ALERT_SEVERITY_WEIGHT[right.severity] || 0) - (ALERT_SEVERITY_WEIGHT[left.severity] || 0);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export async function attachUserNames<
  T extends {
    createdById: string;
    acknowledgedById?: string | null;
  },
>(prisma: PrismaService, alerts: T[]) {
  const userIds = Array.from(
    new Set(
      alerts
        .flatMap((alert) => [alert.createdById, alert.acknowledgedById])
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (userIds.length === 0) {
    return alerts.map((alert) => ({
      ...alert,
      createdBy: null,
      acknowledgedBy: null,
    }));
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nombre: true },
  });
  const userMap = new Map(users.map((user) => [user.id, user]));

  return alerts.map((alert) => ({
    ...alert,
    createdBy: userMap.get(alert.createdById) || null,
    acknowledgedBy: alert.acknowledgedById ? userMap.get(alert.acknowledgedById) || null : null,
  }));
}
