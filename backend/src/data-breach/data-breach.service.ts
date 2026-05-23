import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { RequestUser } from '../common/utils/medico-id';
import { resolvePatientIdentifiers } from '../patients/patients-identifiers';
import {
  AssessDataBreachDto,
  CloseDataBreachDto,
  CreateDataBreachDto,
  NotifyAgencyDto,
  NotifySubjectsDto,
} from './dto/data-breach.dto';

/**
 * Ley 21.719 Art 14 sexies. Anamneo trata datos sensibles, por lo que la
 * notificacion a titulares es obligatoria en toda brecha con riesgo
 * razonable.
 */
@Injectable()
export class DataBreachService {
  private readonly logger = new Logger(DataBreachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async list(filters: { status?: string; severity?: string }, user: RequestUser) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    const items = await this.prisma.dataBreachIncident.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: 200,
    });
    await this.audit.log({
      entityType: 'DataBreachIncident',
      entityId: 'LIST',
      userId: user.id,
      action: 'READ',
      diff: { count: items.length, filters },
    });
    return items;
  }

  async getById(id: string, user: RequestUser) {
    const item = await this.prisma.dataBreachIncident.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Incidente no encontrado');
    await this.audit.log({
      entityType: 'DataBreachIncident',
      entityId: id,
      userId: user.id,
      action: 'READ',
    });
    return item;
  }

  async create(dto: CreateDataBreachDto, user: RequestUser) {
    const created = await this.prisma.dataBreachIncident.create({
      data: {
        detectedAt: new Date(dto.detectedAt),
        severity: dto.severity,
        scope: dto.scope,
        affectedPatientIds: (dto.affectedPatientIds ?? []) as never,
        rootCause: dto.rootCause,
        containmentActions: dto.containmentActions,
        status: 'ABIERTO',
        createdById: user.id,
      },
    });
    await this.audit.log({
      entityType: 'DataBreachIncident',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      diff: {
        severity: dto.severity,
        scope: dto.scope.slice(0, 200),
        affectedCount: (dto.affectedPatientIds ?? []).length,
      },
    });
    this.logger.warn(
      `[Ley 21.719 Art 14 sexies] DataBreachIncident ${created.id} ${dto.severity} ` +
      `detectado. Evalúe "riesgo razonable" y dispare notificaciones segun corresponda.`,
    );
    return created;
  }

  async assess(id: string, dto: AssessDataBreachDto, user: RequestUser) {
    const existing = await this.prisma.dataBreachIncident.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Incidente no encontrado');
    const updated = await this.prisma.dataBreachIncident.update({
      where: { id },
      data: {
        riskAssessment: dto.riskAssessment,
        status: 'EN_EVALUACION',
      },
    });
    await this.audit.log({
      entityType: 'DataBreachIncident',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        assessment: dto.riskAssessment.slice(0, 200),
        agencyDecision: dto.agencyDecision ?? null,
      },
    });
    return updated;
  }

  async notifyAgency(id: string, dto: NotifyAgencyDto, user: RequestUser) {
    const existing = await this.prisma.dataBreachIncident.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Incidente no encontrado');
    if (existing.reportedToAgencyAt) {
      throw new BadRequestException('El incidente ya fue reportado a la Agencia');
    }
    const reportedAt = dto.reportedAt ? new Date(dto.reportedAt) : new Date();
    const updated = await this.prisma.dataBreachIncident.update({
      where: { id },
      data: {
        reportedToAgencyAt: reportedAt,
        status: 'NOTIFICADO',
      },
    });
    await this.audit.log({
      entityType: 'DataBreachIncident',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: { reportedToAgencyAt: reportedAt.toISOString() },
    });
    return updated;
  }

  /**
   * Notifica a los titulares afectados via email (campo `email` del Patient
   * cuando esta disponible). Si Patient no tiene email, se documenta como
   * no notificable por este canal — se debe notificar por otro medio
   * (presencial, correo certificado).
   */
  async notifySubjects(id: string, dto: NotifySubjectsDto, user: RequestUser) {
    const existing = await this.prisma.dataBreachIncident.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Incidente no encontrado');
    if (existing.reportedToSubjectsAt) {
      throw new BadRequestException('Ya se notifico a titulares');
    }
    const affectedIds = (existing.affectedPatientIds as string[] | null) ?? [];
    if (affectedIds.length === 0) {
      throw new BadRequestException('No hay titulares afectados registrados en el incidente');
    }
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: affectedIds } },
      select: { id: true, nombreEnc: true, emailEnc: true },
    });

    let sent = 0;
    let skipped = 0;
    for (const p of patients) {
      const identifiers = resolvePatientIdentifiers(p);
      if (!identifiers.email) {
        skipped += 1;
        continue;
      }
      const res = await this.mail.sendBreachNotificationToSubject({
        to: identifiers.email,
        subjectName: identifiers.nombre,
        breachId: id,
        detectedAt: existing.detectedAt,
        scope: existing.scope,
        measuresTaken: dto.measuresTaken,
        responsableName: dto.responsableName,
        dpoName: dto.dpoName,
        dpoEmail: dto.dpoEmail,
        dataCategoriesAffected: dto.dataCategoriesAffected,
        possibleConsequences: dto.possibleConsequences,
        recommendedActions: dto.recommendedActions,
        consultationChannels: dto.consultationChannels,
        followUpInfo: dto.followUpInfo,
      });
      if (res.sent) sent += 1;
      else skipped += 1;
    }
    const notifiedAt = dto.notifiedAt ? new Date(dto.notifiedAt) : new Date();
    const updated = await this.prisma.dataBreachIncident.update({
      where: { id },
      data: { reportedToSubjectsAt: notifiedAt, status: 'NOTIFICADO' },
    });
    await this.audit.log({
      entityType: 'DataBreachIncident',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        reportedToSubjectsAt: notifiedAt.toISOString(),
        emailsSent: sent,
        emailsSkipped: skipped,
        skippedReason: skipped > 0 ? 'NO_EMAIL_OR_DELIVERY_FAILED' : undefined,
      },
    });
    return { ...updated, deliveryStats: { sent, skipped } };
  }

  async close(id: string, dto: CloseDataBreachDto, user: RequestUser) {
    const existing = await this.prisma.dataBreachIncident.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Incidente no encontrado');
    if (existing.status === 'CERRADO') {
      throw new BadRequestException('El incidente ya esta cerrado');
    }
    const updated = await this.prisma.dataBreachIncident.update({
      where: { id },
      data: {
        status: 'CERRADO',
        // Agregamos el post-mortem al rootCause si esta vacio, o lo
        // anexamos.
        rootCause: existing.rootCause
          ? `${existing.rootCause}\n\n--- Post-mortem ---\n${dto.postMortem}`
          : dto.postMortem,
      },
    });
    await this.audit.log({
      entityType: 'DataBreachIncident',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: { status: 'CERRADO', postMortemSize: dto.postMortem.length },
    });
    return updated;
  }
}
