import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { RequestUser } from '../common/utils/medico-id';
import {
  AdminUpdateDataRequestDto,
  ExtendDataRequestDto,
  PublicDataRequestDto,
  ResolveDataRequestDto,
} from './dto/patient-data-rights.dto';

const RESPONSE_SLA_DAYS = 30; // Ley 21.719 Art 11 (30 dias corridos)
const PRORROGA_DAYS = 30;
const SLA_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class PatientDataRightsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PatientDataRightsService.name);
  private slaTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    // SLA loop simple. Reemplazar por @nestjs/schedule si se justifica (la
    // app es single-clinic con baja concurrencia, basta con un interval).
    this.slaTimer = setInterval(
      () => this.markExpiredRequests().catch((err) => this.logger.warn(`SLA check failed: ${err}`)),
      SLA_CHECK_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.slaTimer) clearInterval(this.slaTimer);
  }

  // ---------- Public submission (titular) ----------

  async createFromPublic(dto: PublicDataRequestDto, requestMeta: { ip?: string; userAgent?: string }) {
    const now = new Date();
    const dueDate = new Date(now.getTime() + RESPONSE_SLA_DAYS * 24 * 60 * 60 * 1000);
    const submittedBy = dto.submittedBy ?? 'TITULAR';

    const created = await this.prisma.patientDataRequest.create({
      data: {
        requestType: dto.requestType,
        status: 'RECIBIDA',
        submittedBy,
        requesterName: dto.requesterName,
        requesterRut: dto.requesterRut,
        requesterEmail: dto.requesterEmail,
        payloadRequest: dto.payloadRequest,
        dueDate,
      },
    });

    await this.audit.log({
      entityType: 'PatientDataRequest',
      entityId: created.id,
      // Solicitudes publicas no tienen userId del sistema; usamos el id de
      // la propia request como referencia sintetica.
      userId: created.id,
      action: 'CREATE',
      diff: {
        requestType: dto.requestType,
        submittedBy,
        requesterEmailDomain: dto.requesterEmail.split('@')[1] ?? null,
        ip: requestMeta.ip ?? null,
      },
    });

    // Acuse de recibo al titular
    await this.mail.sendDataRequestAcknowledgement({
      to: dto.requesterEmail,
      requesterName: dto.requesterName,
      requestId: created.id,
      requestType: dto.requestType,
      dueDate,
    });

    return { id: created.id, status: created.status, dueDate: created.dueDate };
  }

  // ---------- Admin operations ----------

  async list(filters: { status?: string; requestType?: string }, user: RequestUser) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.requestType) where.requestType = filters.requestType;
    const items = await this.prisma.patientDataRequest.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 200,
    });
    await this.audit.log({
      entityType: 'PatientDataRequest',
      entityId: 'LIST',
      userId: user.id,
      action: 'READ',
      diff: { count: items.length, filters },
    });
    return items;
  }

  async getById(id: string, user: RequestUser) {
    const item = await this.prisma.patientDataRequest.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Solicitud no encontrada');
    await this.audit.log({
      entityType: 'PatientDataRequest',
      entityId: id,
      userId: user.id,
      action: 'READ',
    });
    return item;
  }

  async adminUpdate(id: string, dto: AdminUpdateDataRequestDto, user: RequestUser) {
    const existing = await this.prisma.patientDataRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Solicitud no encontrada');
    if (existing.status === 'RESUELTA_ACEPTADA' || existing.status === 'RESUELTA_RECHAZADA') {
      throw new BadRequestException('No se puede modificar una solicitud ya resuelta');
    }
    const updated = await this.prisma.patientDataRequest.update({
      where: { id },
      data: {
        patientId: dto.patientId ?? existing.patientId,
        identityVerificationMethod: dto.identityVerificationMethod ?? existing.identityVerificationMethod,
        identityVerificationEvidence: dto.identityVerificationEvidence as never ?? existing.identityVerificationEvidence,
        status: dto.status ?? existing.status,
      },
    });
    await this.audit.log({
      entityType: 'PatientDataRequest',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: { adminUpdate: true, patientLinked: !!dto.patientId, status: dto.status ?? existing.status },
    });
    return updated;
  }

  async extend(id: string, dto: ExtendDataRequestDto, user: RequestUser) {
    const existing = await this.prisma.patientDataRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Solicitud no encontrada');
    if (existing.prorrogaDueDate) {
      throw new BadRequestException('La solicitud ya tiene prórroga aplicada (Ley 21.719 Art 11 permite solo una)');
    }
    const prorrogaDueDate = new Date(existing.dueDate.getTime() + PRORROGA_DAYS * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.patientDataRequest.update({
      where: { id },
      data: { prorrogaDueDate },
    });
    await this.audit.log({
      entityType: 'PatientDataRequest',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: { extension: true, prorrogaDueDate: prorrogaDueDate.toISOString(), reason: dto.reason.slice(0, 200) },
    });
    await this.mail.sendDataRequestExtended({
      to: existing.requesterEmail,
      requesterName: existing.requesterName,
      requestId: existing.id,
      requestType: existing.requestType,
      newDueDate: prorrogaDueDate,
      reason: dto.reason,
    });
    return updated;
  }

  async resolve(id: string, dto: ResolveDataRequestDto, user: RequestUser) {
    const existing = await this.prisma.patientDataRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Solicitud no encontrada');
    if (existing.status === 'RESUELTA_ACEPTADA' || existing.status === 'RESUELTA_RECHAZADA') {
      throw new BadRequestException('La solicitud ya está resuelta');
    }
    const updated = await this.prisma.patientDataRequest.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedAt: new Date(),
        resolvedById: user.id,
        resolutionNote: dto.resolutionNote,
      },
    });
    await this.audit.log({
      entityType: 'PatientDataRequest',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: { status: dto.status, resolvedAt: new Date().toISOString() },
    });
    if (dto.status === 'RESUELTA_ACEPTADA') {
      await this.mail.sendDataRequestResolved({
        to: existing.requesterEmail,
        requesterName: existing.requesterName,
        requestId: existing.id,
        requestType: existing.requestType,
        resolutionNote: dto.resolutionNote,
      });
    } else {
      await this.mail.sendDataRequestRejected({
        to: existing.requesterEmail,
        requesterName: existing.requesterName,
        requestId: existing.id,
        requestType: existing.requestType,
        reason: dto.resolutionNote,
      });
    }
    return updated;
  }

  // ---------- SLA enforcement ----------

  async markExpiredRequests() {
    const now = new Date();
    const candidates = await this.prisma.patientDataRequest.findMany({
      where: {
        status: { in: ['RECIBIDA', 'EN_REVISION'] },
      },
      select: { id: true, dueDate: true, prorrogaDueDate: true },
    });
    const expired = candidates.filter((r) => (r.prorrogaDueDate ?? r.dueDate) < now);
    for (const r of expired) {
      await this.prisma.patientDataRequest.update({
        where: { id: r.id },
        data: { status: 'VENCIDA' },
      });
      await this.audit.log({
        entityType: 'PatientDataRequest',
        entityId: r.id,
        userId: r.id,
        action: 'UPDATE',
        diff: { status: 'VENCIDA', expiredAt: now.toISOString() },
      });
    }
    if (expired.length > 0) {
      this.logger.warn(`[Ley 21.719] ${expired.length} solicitudes marcadas VENCIDAS (Art 11 vencido).`);
    }
  }
}
