import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyComplianceService } from '../patient-consents/policy-compliance.service';
import { PatientsFieldCryptoService } from './patients-field-crypto.service';
import type { AuditReason } from '../common/types';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { MergePatientDto } from './dto/merge-patient.dto';
import { UpsertPatientProblemDto } from './dto/upsert-patient-problem.dto';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';
import { CreatePatientTaskInput, UpdatePatientTaskInput } from './patients-clinical-write-side';
import { RequestUser } from '../common/utils/medico-id';
import { assertPatientAccessScope } from './patients-access';
import { FindPatientsFilters } from './patients-read-side';
import { PatientTaskInboxFilters } from './patients-task-read-model';
import {
  findAllPatients,
  findPossiblePatientDuplicates,
  exportPatientsCsv,
  getPatientAdminSummary,
  findPatientById,
  findEncounterTimeline,
  findOperationalHistory,
  getClinicalSummary,
  findTasks,
} from './patients-service-read.helpers';
import {
  createPatient,
  createQuickPatient,
  updatePatient,
  updateAdminFields,
  verifyDemographics,
  mergeIntoTarget,
  updateHistory,
  removePatient,
  restorePatient,
  createProblem,
  updateProblem,
  createTask,
  updateTaskStatus,
} from './patients-service-write.helpers';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private policyCompliance: PolicyComplianceService,
    private fieldCrypto: PatientsFieldCryptoService,
  ) {}

  private async logPatientReadEvent(params: {
    user: RequestUser;
    entityType: string;
    entityId: string;
    reason: AuditReason;
    diff: Record<string, unknown>;
  }) {
    const { user, entityType, entityId, reason, diff } = params;

    await this.auditService.log({
      entityType,
      entityId,
      userId: user.id,
      action: 'READ',
      reason,
      diff,
    });
  }

  private readonly assertPatientAccess = (user: RequestUser, patientId: string) => assertPatientAccessScope({
    prisma: this.prisma,
    user,
    patientId,
  });

  async create(createPatientDto: CreatePatientDto, userId: string) {
    const created = await createPatient(this.prisma, this.auditService, createPatientDto, userId);
    await this.enrichEncryptedIdentifiers(created.id, createPatientDto);
    return created;
  }

  async createQuick(createPatientDto: CreatePatientQuickDto, user: RequestUser) {
    const created = await createQuickPatient(this.prisma, this.auditService, createPatientDto, user);
    await this.enrichEncryptedIdentifiers(created.id, createPatientDto);
    return created;
  }

  /**
   * Ley 21.719 Art 14 quinquies — dual-write Phase A.
   *
   * Llamado despues de cada create/update del paciente para poblar las
   * columnas `*_enc` y `rut_lookup_hash`. No bloquea la operacion si la
   * clave de cifrado no esta configurada (modo dev/test).
   */
  private async enrichEncryptedIdentifiers(
    patientId: string,
    input: {
      rut?: string | null;
      nombre?: string | null;
      telefono?: string | null;
      email?: string | null;
      domicilio?: string | null;
      contactoEmergenciaNombre?: string | null;
      contactoEmergenciaTelefono?: string | null;
    },
  ): Promise<void> {
    const enc = this.fieldCrypto.buildEncryptedFields(input);
    // Si TODOS los valores son null, no hay nada que actualizar.
    const hasAnyEncrypted =
      enc.rutEnc !== null ||
      enc.nombreEnc !== null ||
      enc.telefonoEnc !== null ||
      enc.emailEnc !== null ||
      enc.domicilioEnc !== null ||
      enc.contactoEmergenciaNombreEnc !== null ||
      enc.contactoEmergenciaTelefonoEnc !== null ||
      enc.rutLookupHash !== null;
    if (!hasAnyEncrypted) return;
    try {
      await this.prisma.patient.update({
        where: { id: patientId },
        data: enc,
      });
    } catch (err) {
      // Una falla aqui no debe romper la operacion principal del paciente.
      // El error se loggea para diagnostico.
      // eslint-disable-next-line no-console
      console.warn(`[patients.service] enrichEncryptedIdentifiers failed for ${patientId}: ${(err as Error).message}`);
    }
  }

  async findAll(
    user: RequestUser,
    search?: string,
    page = 1,
    limit = 20,
    filters?: FindPatientsFilters,
  ) {
    const result = await findAllPatients(this.prisma, user, search, page, limit, filters);

    await this.logPatientReadEvent({
      user,
      entityType: 'PatientList',
      entityId: user.id,
      reason: 'PATIENT_LIST_VIEWED',
      diff: {
        scope: 'PATIENT_LIST',
        hasSearch: Boolean(search?.trim()),
        page,
        limit,
        total: result.pagination.total,
        returned: result.data.length,
      },
    });

    return result;
  }

  async findPossibleDuplicates(
    user: RequestUser,
    params: {
      rut?: string;
      nombre?: string;
      fechaNacimiento?: string;
      excludePatientId?: string;
    },
  ) {
    const duplicates = await findPossiblePatientDuplicates(this.prisma, user, params);

    await this.logPatientReadEvent({
      user,
      entityType: 'PatientDuplicatesSearch',
      entityId: user.id,
      reason: 'PATIENT_DUPLICATES_SEARCHED',
      diff: {
        scope: 'PATIENT_DUPLICATES_SEARCH',
        criteria: {
          rut: Boolean(params.rut?.trim()),
          nombre: Boolean(params.nombre?.trim()),
          fechaNacimiento: Boolean(params.fechaNacimiento),
          excludePatientId: Boolean(params.excludePatientId),
        },
        matchCount: duplicates.length,
      },
    });

    return duplicates;
  }

  async exportCsv(user: RequestUser) {
    return exportPatientsCsv(this.prisma, this.auditService, user);
  }

  async getAdminSummary(user: RequestUser, id: string) {
    const summary = await getPatientAdminSummary(this.prisma, user, id);

    await this.logPatientReadEvent({
      user,
      entityType: 'PatientAdminSummary',
      entityId: id,
      reason: 'PATIENT_ADMIN_SUMMARY_VIEWED',
      diff: {
        scope: 'PATIENT_ADMIN_SUMMARY',
        encounterCount: summary.metrics.encounterCount,
        hasRecentEncounter: Boolean(summary.metrics.lastEncounterAt),
        completenessStatus: summary.completenessStatus,
      },
    });

    return summary;
  }

  async findById(user: RequestUser, id: string) {
    const patient = await findPatientById(this.prisma, user, id);
    await this.auditService.log({
      entityType: 'Patient',
      entityId: id,
      userId: user.id,
      action: 'READ',
      reason: 'PATIENT_RECORD_VIEWED',
      diff: { scope: 'PATIENT_RECORD' },
    });
    return patient;
  }

  async findEncounterTimeline(user: RequestUser, patientId: string, page = 1, limit = 10) {
    await this.assertPatientAccess(user, patientId);
    const timeline = await findEncounterTimeline(this.prisma, user, patientId, page, limit);

    await this.logPatientReadEvent({
      user,
      entityType: 'PatientTimeline',
      entityId: patientId,
      reason: 'PATIENT_TIMELINE_VIEWED',
      diff: {
        scope: 'PATIENT_TIMELINE',
        page,
        limit,
        total: timeline.pagination.total,
        returned: timeline.data.length,
      },
    });

    return timeline;
  }

  async findOperationalHistory(user: RequestUser, patientId: string, limit = 20) {
    await this.assertPatientAccess(user, patientId);
    const history = await findOperationalHistory(this.prisma, user, patientId, limit);

    await this.logPatientReadEvent({
      user,
      entityType: 'PatientOperationalHistory',
      entityId: patientId,
      reason: 'PATIENT_OPERATIONAL_HISTORY_VIEWED',
      diff: {
        scope: 'PATIENT_OPERATIONAL_HISTORY',
        limit,
        itemCount: history.length,
      },
    });

    return history;
  }

  async getClinicalSummary(
    user: RequestUser,
    patientId: string,
    options?: { fullVitalHistory?: boolean },
  ) {
    await this.assertPatientAccess(user, patientId);
    const summary = await getClinicalSummary(this.prisma, user, patientId, options);
    await this.auditService.log({
      entityType: 'Patient',
      entityId: patientId,
      userId: user.id,
      action: 'READ',
      reason: 'PATIENT_CLINICAL_SUMMARY_VIEWED',
      diff: { scope: 'CLINICAL_SUMMARY', fullVitalHistory: options?.fullVitalHistory === true },
    });
    return summary;
  }

  async findTasks(
    user: RequestUser,
    filters?: PatientTaskInboxFilters,
  ) {
    const taskInbox = await findTasks(this.prisma, user, filters);

    await this.logPatientReadEvent({
      user,
      entityType: 'PatientTaskInbox',
      entityId: user.id,
      reason: 'PATIENT_TASKS_VIEWED',
      diff: {
        scope: 'PATIENT_TASK_INBOX',
        page: taskInbox.pagination.page,
        limit: taskInbox.pagination.limit,
        total: taskInbox.pagination.total,
        filters: {
          hasSearch: Boolean(filters?.search?.trim()),
          hasStatus: Boolean(filters?.status),
          hasType: Boolean(filters?.type),
          hasPriority: Boolean(filters?.priority),
          overdueOnly: Boolean(filters?.overdueOnly),
        },
      },
    });

    return taskInbox;
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, user: RequestUser) {
    // Ley 21.719 Art 12 - verifica consentimiento vigente para tratamiento clinico.
    // En modo `soft` (default) solo loggea; en `hard` (prod) rechaza.
    await this.policyCompliance.assertConsentFor(id, 'ATENCION_CLINICA');
    const result = await updatePatient(this.prisma, this.auditService, id, updatePatientDto, user);
    await this.enrichEncryptedIdentifiers(id, updatePatientDto);
    return result;
  }

  async updateAdminFields(user: RequestUser, patientId: string, dto: UpdatePatientAdminDto) {
    await this.policyCompliance.assertConsentFor(patientId, 'ATENCION_CLINICA');
    const result = await updateAdminFields(this.prisma, this.auditService, user, patientId, dto, this.assertPatientAccess);
    await this.enrichEncryptedIdentifiers(patientId, dto);
    return result;
  }

  async verifyDemographics(user: RequestUser, patientId: string) {
    return verifyDemographics(this.prisma, this.auditService, user, patientId, this.assertPatientAccess);
  }

  async mergeIntoTarget(user: RequestUser, targetPatientId: string, dto: MergePatientDto) {
    return mergeIntoTarget(this.prisma, this.auditService, user, targetPatientId, dto, this.assertPatientAccess);
  }

  async updateHistory(user: RequestUser, patientId: string, dto: UpdatePatientHistoryDto) {
    return updateHistory(this.prisma, this.auditService, user, patientId, dto, this.assertPatientAccess);
  }

  async remove(id: string, user: RequestUser) {
    return removePatient(this.prisma, this.auditService, id, user);
  }

  async restore(id: string, user: RequestUser) {
    return restorePatient(this.prisma, this.auditService, id, user);
  }

  async createProblem(user: RequestUser, patientId: string, dto: UpsertPatientProblemDto) {
    return createProblem(this.prisma, this.auditService, user, patientId, dto, this.assertPatientAccess);
  }

  async updateProblem(user: RequestUser, problemId: string, dto: UpdatePatientProblemDto) {
    return updateProblem(this.prisma, this.auditService, user, problemId, dto, this.assertPatientAccess);
  }

  async createTask(
    user: RequestUser,
    patientId: string,
    dto: CreatePatientTaskInput,
  ) {
    return createTask(this.prisma, this.auditService, user, patientId, dto, this.assertPatientAccess);
  }

  async updateTaskStatus(
    user: RequestUser,
    taskId: string,
    dto: UpdatePatientTaskInput,
  ) {
    return updateTaskStatus(this.prisma, this.auditService, user, taskId, dto, this.assertPatientAccess);
  }
}
