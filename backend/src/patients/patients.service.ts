import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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
import {
  isPatientOwnedByMedico,
} from '../common/utils/patient-access';
import { isDateOnlyAfterToday, calculateAgeFromBirthDate } from '../common/utils/local-date';
import {
  decoratePatient,
  resolvePatientVerificationState,
} from './patients-format';
import { getClinicalSummaryReadModel, getEncounterTimelineReadModel } from './patients-clinical-read-model';
import {
  updatePatientAdminDemographicsMutation,
  updatePatientDemographicsMutation,
} from './patients-demographics-mutations';
import {
  createPatientProblemMutation,
  createPatientTaskMutation,
  updatePatientProblemMutation,
  updatePatientTaskMutation,
} from './patients-clinical-mutations';
import {
  exportPatientsCsvReadModel,
  findPatientByIdReadModel,
  findPatientsReadModel,
  FindPatientsFilters,
  getPatientAdminSummaryReadModel,
} from './patients-read-side';
import { findPatientTasksReadModel, PatientTaskInboxFilters } from './patients-task-read-model';
import {
  archivePatientMutation,
  restorePatientMutation,
  updatePatientHistoryMutation,
  verifyPatientDemographicsMutation,
} from './patients-lifecycle-mutations';
import { resolveCreatePatientRutInput, resolvePatientRutState } from './patients-create-utils';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async assertPatientAccess(user: RequestUser, patientId: string) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        history: true,
        createdBy: {
          select: { medicoId: true },
        },
      },
    });

    if (!patient || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    // Allow access if user created the patient or has encounters with them
    if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
      const hasEncounter = await this.prisma.encounter.findFirst({
        where: { patientId, medicoId: effectiveMedicoId },
        select: { id: true },
      });
      if (!hasEncounter) {
        throw new NotFoundException('Paciente no encontrado');
      }
    }

    return patient;
  }

  async create(createPatientDto: CreatePatientDto, userId: string) {
    const { formattedRut, trimmedRutExemptReason } = await resolveCreatePatientRutInput({
      prisma: this.prisma,
      rut: createPatientDto.rut,
      rutExempt: createPatientDto.rutExempt,
      rutExemptReason: createPatientDto.rutExemptReason,
      invalidRutMessage: 'El RUT ingresado no es válido',
      missingExemptReasonMessage: 'Debe indicar el motivo de exención de RUT',
    });
    const resolvedRut = resolvePatientRutState({
      rut: createPatientDto.rut,
      rutExempt: createPatientDto.rutExempt,
      formattedRut,
      trimmedRutExemptReason,
    });

    const verificationState = resolvePatientVerificationState({
      actorId: userId,
      actorRole: 'MEDICO',
      mode: 'CREATE_FULL',
      nextPatient: {
        rut: resolvedRut.rut,
        rutExempt: resolvedRut.rutExempt,
        rutExemptReason: resolvedRut.rutExemptReason,
        edad: createPatientDto.edad,
        sexo: createPatientDto.sexo,
        prevision: createPatientDto.prevision,
      },
    });

    if (createPatientDto.fechaNacimiento && isDateOnlyAfterToday(createPatientDto.fechaNacimiento)) {
      throw new BadRequestException('La fecha de nacimiento no puede ser futura');
    }

    const resolvedAge = createPatientDto.fechaNacimiento
      ? calculateAgeFromBirthDate(createPatientDto.fechaNacimiento)
      : { edad: createPatientDto.edad, edadMeses: createPatientDto.edadMeses ?? null };

    const patient = await this.prisma.patient.create({
      data: {
        createdById: userId,
        rut: resolvedRut.rut,
        rutExempt: resolvedRut.rutExempt,
        rutExemptReason: resolvedRut.rutExemptReason,
        nombre: createPatientDto.nombre,
        fechaNacimiento: createPatientDto.fechaNacimiento ? new Date(createPatientDto.fechaNacimiento) : null,
        edad: resolvedAge.edad,
        edadMeses: resolvedAge.edadMeses ?? null,
        sexo: createPatientDto.sexo,
        trabajo: createPatientDto.trabajo,
        prevision: createPatientDto.prevision,
        domicilio: createPatientDto.domicilio,
        centroMedico: createPatientDto.centroMedico,
        registrationMode: 'COMPLETO',
        ...verificationState,
        history: {
          create: {},
        },
      },
      include: {
        history: true,
      },
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: patient.id,
      userId,
      action: 'CREATE',
      diff: { created: patient },
    });

    return decoratePatient(patient);
  }

  async createQuick(createPatientDto: CreatePatientQuickDto, user: RequestUser) {
    const { formattedRut, trimmedRutExemptReason } = await resolveCreatePatientRutInput({
      prisma: this.prisma,
      rut: createPatientDto.rut,
      rutExempt: createPatientDto.rutExempt,
      rutExemptReason: createPatientDto.rutExemptReason,
      invalidRutMessage: 'El RUT ingresado no es valido',
      missingExemptReasonMessage: 'Debe indicar el motivo de exencion de RUT',
    });
    const resolvedRut = resolvePatientRutState({
      rut: createPatientDto.rut,
      rutExempt: createPatientDto.rutExempt,
      formattedRut,
      trimmedRutExemptReason,
    });

    const patient = await this.prisma.patient.create({
      data: {
        createdById: user.id,
        rut: resolvedRut.rut,
        rutExempt: resolvedRut.rutExempt,
        rutExemptReason: resolvedRut.rutExemptReason,
        nombre: createPatientDto.nombre,
        edad: null,
        sexo: null,
        prevision: null,
        trabajo: null,
        domicilio: null,
        registrationMode: 'RAPIDO',
        ...resolvePatientVerificationState({
          actorId: user.id,
          actorRole: user.role,
          mode: 'CREATE_QUICK',
          nextPatient: {
            rut: resolvedRut.rut,
            rutExempt: resolvedRut.rutExempt,
            rutExemptReason: resolvedRut.rutExemptReason,
          },
        }),
        history: {
          create: {},
        },
      },
      include: { history: true },
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: patient.id,
      userId: user.id,
      action: 'CREATE',
      diff: { created: patient, quick: true },
    });

    return decoratePatient(patient);
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
      assertPatientAccess: this.assertPatientAccess.bind(this),
    });

    return decoratePatient(patient);
  }

  async verifyDemographics(user: RequestUser, patientId: string) {
    const updatedPatient = await verifyPatientDemographicsMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      patientId,
      assertPatientAccess: this.assertPatientAccess.bind(this),
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
      assertPatientAccess: this.assertPatientAccess.bind(this),
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
    const effectiveMedicoId = getEffectiveMedicoId(user);
    return createPatientProblemMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      patientId,
      dto,
      effectiveMedicoId,
      assertPatientAccess: this.assertPatientAccess.bind(this),
    });
  }

  async updateProblem(user: RequestUser, problemId: string, dto: UpdatePatientProblemDto) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    return updatePatientProblemMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      problemId,
      dto,
      effectiveMedicoId,
      assertPatientAccess: this.assertPatientAccess.bind(this),
    });
  }

  async createTask(
    user: RequestUser,
    patientId: string,
    dto: {
      title: string;
      details?: string;
      type?: string;
      priority?: string;
      status?: string;
      dueDate?: string;
      encounterId?: string;
    },
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    return createPatientTaskMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      patientId,
      dto,
      effectiveMedicoId,
      assertPatientAccess: this.assertPatientAccess.bind(this),
    });
  }

  async updateTaskStatus(
    user: RequestUser,
    taskId: string,
    dto: {
      title?: string;
      status?: string;
      details?: string;
      type?: string;
      priority?: string;
      dueDate?: string;
    },
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    return updatePatientTaskMutation({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      taskId,
      dto,
      effectiveMedicoId,
      assertPatientAccess: this.assertPatientAccess.bind(this),
    });
  }
}
