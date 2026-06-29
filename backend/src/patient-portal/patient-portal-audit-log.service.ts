import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PatientPortalRequestUser } from './patient-portal.types';

const PORTAL_AUDIT_ENTITY_TYPES = [
  'Patient',
  'PatientHistory',
  'PatientAllergy',
  'ClinicalConsent',
  'PatientDataProcessingConsent',
  'PatientDataRequest',
  'Attachment',
];

@Injectable()
export class PatientPortalAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLog(portalUser: PatientPortalRequestUser, page: number, pageSize = 30) {
    const patientId = portalUser.patientId;
    const skip = (page - 1) * pageSize;

    const encounterIds = await this.prisma.encounter.findMany({
      where: { patientId },
      select: { id: true },
    }).then((rows) => rows.map((row) => row.id));

    const where = {
      OR: [
        { entityType: { in: PORTAL_AUDIT_ENTITY_TYPES }, entityId: patientId },
        { entityType: 'Encounter', entityId: { in: encounterIds } },
      ],
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: pageSize,
        skip,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          action: true,
          reason: true,
          result: true,
          timestamp: true,
          userId: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((log) => log.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre: true, role: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    const items = logs.map((log) => {
      const actor = userMap.get(log.userId);
      const initials = actor
        ? actor.nombre.split(' ').slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('')
        : '?';
      return {
        id: log.id,
        entityType: log.entityType,
        action: log.action,
        reason: log.reason,
        result: log.result,
        timestamp: log.timestamp,
        actorRole: actor?.role ?? 'DESCONOCIDO',
        actorInitials: initials,
      };
    });

    return { items, total, page, pageSize };
  }

  async exportAuditLogCsv(portalUser: PatientPortalRequestUser) {
    const { items } = await this.getAuditLog(portalUser, 1, 1000);
    const rows = [
      ['fecha_hora', 'seccion', 'accion', 'motivo', 'resultado', 'rol_actor', 'iniciales_actor'],
      ...items.map((item) => [
        item.timestamp.toISOString(),
        item.entityType,
        item.action,
        item.reason ?? '',
        item.result,
        item.actorRole,
        item.actorInitials,
      ]),
    ];
    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}
