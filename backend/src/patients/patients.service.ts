import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { UpsertPatientProblemDto } from './dto/upsert-patient-problem.dto';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { decoratePatient } from './patients-format';
import { getClinicalSummaryReadModel, getEncounterTimelineReadModel } from './patients-clinical-read-model';
import {
  updatePatientAdminDemographicsMutation,
  updatePatientDemographicsMutation,
} from './patients-demographics-mutations';
import {
  createPatientProblemCommand,
  createPatientTaskCommand,
  CreatePatientTaskInput,
  updatePatientProblemCommand,
  updatePatientTaskCommand,
  UpdatePatientTaskInput,
} from './patients-clinical-write-side';
import {
  exportPatientsCsvReadModel,
  findPatientByIdReadModel,
  findPossiblePatientDuplicatesReadModel,
  findPatientsReadModel,
  FindPatientsFilters,
  getPatientAdminSummaryReadModel,
} from './patients-read-side';
import type { PossiblePatientDuplicate } from './patients-read-side';
import { findPatientTasksReadModel, PatientTaskInboxFilters } from './patients-task-read-model';
import {
  archivePatientMutation,
  restorePatientMutation,
  updatePatientHistoryMutation,
  verifyPatientDemographicsMutation,
} from './patients-lifecycle-mutations';
import {
  createPatientMutation,
  createQuickPatientMutation,
} from './patients-intake-mutations';
import { assertPatientAccessScope } from './patients-access';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private readonly assertPatientAccess = (user: RequestUser, patientId: string) => assertPatientAccessScope({
    prisma: this.prisma,
    user,
    patientId,
  });

  async create(createPatientDto: CreatePatientDto, userId: string) {
    return createPatientMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      createPatientDto,
      userId,
    });
  }

  async createQuick(createPatientDto: CreatePatientQuickDto, user: RequestUser) {
    return createQuickPatientMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      createPatientDto,
      user,
    });
  }

  async findAll(
    user: RequestUser,
    search?: string,
    page = 1,
    limit = 20,
    filters?: FindPatientsFilters,
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return findPatientsReadModel({
      prisma: this.prisma,
      user,
      effectiveMedicoId,
      search,
      page,
      limit,
      filters,
    });
  }

  async findPossibleDuplicates(
    user: RequestUser,
    params: {
      rut?: string;
      nombre?: string;
      fechaNacimiento?: string;
      excludePatientId?: string;
    },
  ): Promise<PossiblePatientDuplicate[]> {
    return findPossiblePatientDuplicatesReadModel({
      prisma: this.prisma,
      user,
      ...params,
    });
  }

  /**
   * Exports all non-archived patients as CSV.
   *
   * Scope: This endpoint is intentionally restricted to ADMIN users only
   * (enforced by AdminGuard in the controller) and exports patients across
   * all medicos in the system. This is by design for administrative oversight
   * and reporting — it is NOT scoped per medico.
   *
   * The export event is recorded in the audit log with the total patient count.
   */
  async exportCsv(user: RequestUser) {
    return exportPatientsCsvReadModel({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
    });
  }

  async getAdminSummary(user: RequestUser, id: string) {
    return getPatientAdminSummaryReadModel({
      prisma: this.prisma,
      id,
    });
  }

  async findById(user: RequestUser, id: string) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return findPatientByIdReadModel({
      prisma: this.prisma,
      user,
      id,
      effectiveMedicoId,
    });
  }

  async findEncounterTimeline(user: RequestUser, patientId: string, page = 1, limit = 10) {
    await this.assertPatientAccess(user, patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);

    return getEncounterTimelineReadModel({
      prisma: this.prisma,
      patientId,
      effectiveMedicoId,
      page,
      limit,
    });
  }

  async getClinicalSummary(
    user: RequestUser,
    patientId: string,
    options?: { fullVitalHistory?: boolean },
  ) {
    await this.assertPatientAccess(user, patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const fullVitals = options?.fullVitalHistory === true;

    return getClinicalSummaryReadModel({
      prisma: this.prisma,
      user,
      patientId,
      effectiveMedicoId,
      fullVitals,
    });
  }

  async findTasks(
    user: RequestUser,
    filters?: PatientTaskInboxFilters,
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return findPatientTasksReadModel({
      prisma: this.prisma,
      user,
      effectiveMedicoId,
      filters,
    });
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const patient = await updatePatientDemographicsMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      updatePatientDto,
      user,
      effectiveMedicoId,
    });

    return decoratePatient(patient);
  }

  async updateAdminFields(user: RequestUser, patientId: string, dto: UpdatePatientAdminDto) {
    const patient = await updatePatientAdminDemographicsMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      patientId,
      dto,
      user,
      assertPatientAccess: this.assertPatientAccess,
    });

    return decoratePatient(patient);
  }

  async verifyDemographics(user: RequestUser, patientId: string) {
    const updatedPatient = await verifyPatientDemographicsMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      patientId,
      assertPatientAccess: this.assertPatientAccess,
    });

    return decoratePatient(updatedPatient);
  }

  async updateHistory(user: RequestUser, patientId: string, dto: UpdatePatientHistoryDto) {
    return updatePatientHistoryMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      patientId,
      dto,
      assertPatientAccess: this.assertPatientAccess,
    });
  }

  async remove(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return archivePatientMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      user,
      effectiveMedicoId,
    });
  }

  async restore(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return restorePatientMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      id,
      user,
      effectiveMedicoId,
    });
  }

  async createProblem(user: RequestUser, patientId: string, dto: UpsertPatientProblemDto) {
    return createPatientProblemCommand({
      prisma: this.prisma,
      auditService: this.auditService,
      assertPatientAccess: this.assertPatientAccess,
      user,
      patientId,
      dto,
    });
  }

  async updateProblem(user: RequestUser, problemId: string, dto: UpdatePatientProblemDto) {
    return updatePatientProblemCommand({
      prisma: this.prisma,
      auditService: this.auditService,
      assertPatientAccess: this.assertPatientAccess,
      user,
      problemId,
      dto,
    });
  }

  async createTask(
    user: RequestUser,
    patientId: string,
    dto: CreatePatientTaskInput,
  ) {
    return createPatientTaskCommand({
      prisma: this.prisma,
      auditService: this.auditService,
      assertPatientAccess: this.assertPatientAccess,
      user,
      patientId,
      dto,
    });
  }

  async updateTaskStatus(
    user: RequestUser,
    taskId: string,
    dto: UpdatePatientTaskInput,
  ) {
    return updatePatientTaskCommand({
      prisma: this.prisma,
      auditService: this.auditService,
      assertPatientAccess: this.assertPatientAccess,
      user,
      taskId,
      dto,
    });
  }
}
