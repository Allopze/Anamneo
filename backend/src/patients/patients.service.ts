import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  ) {}

  private readonly assertPatientAccess = (user: RequestUser, patientId: string) => assertPatientAccessScope({
    prisma: this.prisma,
    user,
    patientId,
  });

  async create(createPatientDto: CreatePatientDto, userId: string) {
    return createPatient(this.prisma, this.auditService, createPatientDto, userId);
  }

  async createQuick(createPatientDto: CreatePatientQuickDto, user: RequestUser) {
    return createQuickPatient(this.prisma, this.auditService, createPatientDto, user);
  }

  async findAll(
    user: RequestUser,
    search?: string,
    page = 1,
    limit = 20,
    filters?: FindPatientsFilters,
  ) {
    return findAllPatients(this.prisma, user, search, page, limit, filters);
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
    return findPossiblePatientDuplicates(this.prisma, user, params);
  }

  async exportCsv(user: RequestUser) {
    return exportPatientsCsv(this.prisma, this.auditService, user);
  }

  async getAdminSummary(user: RequestUser, id: string) {
    return getPatientAdminSummary(this.prisma, user, id);
  }

  async findById(user: RequestUser, id: string) {
    return findPatientById(this.prisma, user, id);
  }

  async findEncounterTimeline(user: RequestUser, patientId: string, page = 1, limit = 10) {
    await this.assertPatientAccess(user, patientId);
    return findEncounterTimeline(this.prisma, user, patientId, page, limit);
  }

  async findOperationalHistory(user: RequestUser, patientId: string, limit = 20) {
    await this.assertPatientAccess(user, patientId);
    return findOperationalHistory(this.prisma, user, patientId, limit);
  }

  async getClinicalSummary(
    user: RequestUser,
    patientId: string,
    options?: { fullVitalHistory?: boolean },
  ) {
    await this.assertPatientAccess(user, patientId);
    return getClinicalSummary(this.prisma, user, patientId, options);
  }

  async findTasks(
    user: RequestUser,
    filters?: PatientTaskInboxFilters,
  ) {
    return findTasks(this.prisma, user, filters);
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, user: RequestUser) {
    return updatePatient(this.prisma, this.auditService, id, updatePatientDto, user);
  }

  async updateAdminFields(user: RequestUser, patientId: string, dto: UpdatePatientAdminDto) {
    return updateAdminFields(this.prisma, this.auditService, user, patientId, dto, this.assertPatientAccess);
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
