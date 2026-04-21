import { NotFoundException } from '@nestjs/common';
import { AUDIT_REASON_LABELS } from '../audit/audit-catalog';
import { SectionKey } from '../common/types';
import { ENCOUNTER_SECTION_LABELS as SECTION_LABELS } from '../common/utils/encounter-section-meta';
import { PrismaService } from '../prisma/prisma.service';

interface EncounterAuditHistoryReadModelParams {
  prisma: PrismaService;
  encounterId: string;
  effectiveMedicoId: string;
}

export async function getEncounterAuditHistoryReadModel(params: EncounterAuditHistoryReadModelParams) {
  const { prisma, encounterId, effectiveMedicoId } = params;

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, medicoId: effectiveMedicoId },
    select: {
      id: true,
      sections: { select: { id: true, sectionKey: true } },
    },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  const sectionIds = encounter.sections.map((section) => section.id);
  const sectionKeyMap = new Map(encounter.sections.map((section) => [section.id, section.sectionKey]));

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'Encounter', entityId: encounterId },
        ...(sectionIds.length > 0 ? [{ entityType: 'EncounterSection', entityId: { in: sectionIds } }] : []),
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });

  const userIds = [...new Set(logs.map((log) => log.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nombre: true },
  });
  const userMap = new Map(users.map((user) => [user.id, user.nombre]));

  return logs.map((log) => {
    const sectionKey = log.entityType === 'EncounterSection' ? (sectionKeyMap.get(log.entityId) ?? null) : null;
    const reason = log.reason as string | null;
    const label =
      reason && reason in AUDIT_REASON_LABELS
        ? AUDIT_REASON_LABELS[reason as keyof typeof AUDIT_REASON_LABELS]
        : (reason ?? log.action);

    return {
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      reason,
      label,
      userName: userMap.get(log.userId) ?? 'Sistema',
      sectionKey,
      sectionLabel: sectionKey ? (SECTION_LABELS[sectionKey as SectionKey] ?? sectionKey) : null,
    };
  });
}
