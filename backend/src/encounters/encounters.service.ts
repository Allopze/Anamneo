import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { SectionKey, EncounterStatus } from '../common/types';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { AlertsService } from '../alerts/alerts.service';
import {
  reconcileEncounterIdentificationSection,
  updateEncounterSectionMutation,
} from './encounters-section-mutations';
import {
  cancelEncounterWorkflowMutation,
  completeEncounterWorkflowMutation,
  reopenEncounterWorkflowMutation,
  signEncounterWorkflowMutation,
  updateEncounterReviewStatusMutation,
} from './encounters-workflow-mutations';
import {
  createEncounterMutation,
} from './encounters-create-mutation';
import {
  findEncounterByIdReadModel,
  findEncountersByPatientReadModel,
  findEncountersReadModel,
} from './encounters-read-side';
import { getEncounterDashboardReadModel } from './encounters-dashboard-read-model';
import { getEncounterAuditHistoryReadModel } from './encounters-audit-history';

@Injectable()
export class EncountersService {
  private readonly logger = new Logger(EncountersService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private alertsService: AlertsService,
  ) {}

  // ─── Create ──────────────────────────────────────────────────────────────

  async create(patientId: string, createDto: CreateEncounterDto, user: RequestUser) {
    return createEncounterMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      patientId,
      createDto,
      user,
    });
  }

  // ─── Read ────────────────────────────────────────────────────────────────

  async findAll(
    user: RequestUser,
    status: EncounterStatus | undefined,
    search: string | undefined,
    reviewStatus: string | undefined,
    page = 1,
    limit = 15,
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return findEncountersReadModel({
      prisma: this.prisma,
      effectiveMedicoId,
      status,
      search,
      reviewStatus,
      page,
      limit,
    });
  }

  async findById(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return findEncounterByIdReadModel({
      prisma: this.prisma,
      id,
      effectiveMedicoId,
    });
  }

  async findByPatient(patientId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return findEncountersByPatientReadModel({
      prisma: this.prisma,
      patientId,
      effectiveMedicoId,
    });
  }

  // ─── Section update ──────────────────────────────────────────────────────

  async reconcileIdentificationSnapshot(encounterId: string, user: RequestUser) {
    return reconcileEncounterIdentificationSection({
      prisma: this.prisma,
      auditService: this.auditService,
      encounterId,
      user,
    });
  }

  async updateSection(encounterId: string, sectionKey: SectionKey, dto: any, user: RequestUser) {
    return updateEncounterSectionMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      alertsService: this.alertsService,
      logger: this.logger,
      encounterId,
      sectionKey,
      dto,
      user,
    });
  }

  // ─── Workflow transitions ────────────────────────────────────────────────

  async complete(id: string, userId: string, closureNote?: string) {
    return completeEncounterWorkflowMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      userId,
      closureNote,
    });
  }

  async sign(id: string, userId: string, password: string, context: { ipAddress?: string; userAgent?: string }) {
    return signEncounterWorkflowMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      userId,
      password,
      context,
    });
  }

  async reopen(id: string, userId: string, note: string) {
    return reopenEncounterWorkflowMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      userId,
      note,
    });
  }

  async cancel(id: string, userId: string) {
    return cancelEncounterWorkflowMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      userId,
    });
  }

  async updateReviewStatus(
    id: string,
    user: RequestUser,
    reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO',
    note?: string,
  ) {
    return updateEncounterReviewStatusMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      user,
      reviewStatus,
      note,
    });
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard(user: RequestUser) {
    const medicoId = getEffectiveMedicoId(user);
    return getEncounterDashboardReadModel({
      prisma: this.prisma,
      user,
      medicoId,
    });
  }

  // ─── Audit history ───────────────────────────────────────────────────────

  async getAuditHistory(encounterId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return getEncounterAuditHistoryReadModel({
      prisma: this.prisma,
      encounterId,
      effectiveMedicoId,
    });
  }
}
