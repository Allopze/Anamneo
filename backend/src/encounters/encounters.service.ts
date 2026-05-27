import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyComplianceService } from '../patient-consents/policy-compliance.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { ReassignEncounterDto } from './dto/reassign-encounter.dto';
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
import { type EncounterReopenReasonCode } from '../../../shared/encounter-reopen-reasons';
import {
  createEncounterMutation,
} from './encounters-create-mutation';
import {
  findEncounterByIdReadModel,
  findEncountersByPatientReadModel,
  findEncountersReadModel,
} from './encounters-read-side';
import { getEncounterDashboardReadModel, getEncounterHeaderCountsReadModel } from './encounters-dashboard-read-model';
import { getEncounterAuditHistoryReadModel } from './encounters-audit-history';
import { reassignEncounterMutation } from './encounters-reassignment-mutation';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class EncountersService {
  private readonly logger = new Logger(EncountersService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private alertsService: AlertsService,
    private policyCompliance: PolicyComplianceService,
    private settingsService: SettingsService,
  ) {}

  // ─── Create ──────────────────────────────────────────────────────────────

  async create(patientId: string, createDto: CreateEncounterDto, user: RequestUser) {
    // Ley 21.719 Art 12 + Art 16 lit e - exige consentimiento del titular
    // antes de iniciar una nueva atencion. En modo `soft` solo loggea.
    await this.policyCompliance.assertConsentFor(patientId, 'ATENCION_CLINICA');
    const sectionConfig = await this.settingsService.getEncounterSectionConfig();
    return createEncounterMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      patientId,
      createDto,
      user,
      sectionConfig,
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
    const sectionConfig = await this.settingsService.getEncounterSectionConfig();
    return findEncountersReadModel({
      prisma: this.prisma,
      effectiveMedicoId,
      status,
      search,
      reviewStatus,
      page,
      limit,
      sectionConfig,
    });
  }

  async findById(
    id: string,
    user: RequestUser,
    options: {
      includeSignatureBaseline?: boolean;
      includeAttachments?: boolean;
      includeConsents?: boolean;
      includeTasks?: boolean;
      includeSignatures?: boolean;
      includeSuggestions?: boolean;
    } = {},
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const sectionConfig = await this.settingsService.getEncounterSectionConfig();
    const encounter = await findEncounterByIdReadModel({
      prisma: this.prisma,
      id,
      effectiveMedicoId,
      user,
      includeSignatureBaseline: options.includeSignatureBaseline,
      includeAttachments: options.includeAttachments,
      includeConsents: options.includeConsents,
      includeTasks: options.includeTasks,
      includeSignatures: options.includeSignatures,
      includeSuggestions: options.includeSuggestions,
      sectionConfig,
    });
    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId: user.id,
      action: 'READ',
      reason: 'ENCOUNTER_RECORD_VIEWED',
      diff: {
        scope: 'ENCOUNTER_RECORD',
        includeAttachments: options.includeAttachments !== false,
        includeConsents: options.includeConsents !== false,
        includeTasks: options.includeTasks !== false,
      },
    });
    return encounter;
  }

  async findByPatient(patientId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const sectionConfig = await this.settingsService.getEncounterSectionConfig();
    const timeline = await findEncountersByPatientReadModel({
      prisma: this.prisma,
      patientId,
      effectiveMedicoId,
      sectionConfig,
    });
    await this.auditService.log({
      entityType: 'Encounter',
      entityId: patientId,
      userId: user.id,
      action: 'READ',
      reason: 'ENCOUNTER_TIMELINE_VIEWED',
      diff: { scope: 'TIMELINE', patientId },
    });
    return timeline;
  }

  async duplicate(sourceEncounterId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const sourceEncounter = await this.prisma.encounter.findFirst({
      where: {
        id: sourceEncounterId,
        medicoId: effectiveMedicoId,
      },
      select: { patientId: true },
    });

    if (!sourceEncounter) {
      throw new NotFoundException('Atención base no encontrada');
    }

    return this.create(sourceEncounter.patientId, { duplicateFromEncounterId: sourceEncounterId }, user);
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
    const sectionConfig = await this.settingsService.getEncounterSectionConfig();
    return updateEncounterSectionMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      alertsService: this.alertsService,
      logger: this.logger,
      encounterId,
      sectionKey,
      dto,
      user,
      sectionConfig,
    });
  }

  // ─── Workflow transitions ────────────────────────────────────────────────

  async complete(id: string, userId: string, closureNote?: string) {
    const sectionConfig = await this.settingsService.getEncounterSectionConfig();
    return completeEncounterWorkflowMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      userId,
      closureNote,
      sectionConfig,
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

  async reopen(id: string, userId: string, note: string, reasonCode: EncounterReopenReasonCode) {
    return reopenEncounterWorkflowMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      userId,
      note,
      reasonCode,
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

  async reassignEncounter(id: string, dto: ReassignEncounterDto, user: RequestUser) {
    return reassignEncounterMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      encounterId: id,
      dto,
      user,
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

  async getHeaderCounts(user: RequestUser) {
    const medicoId = getEffectiveMedicoId(user);
    return getEncounterHeaderCountsReadModel({
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
