import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { validateRut } from '../common/utils/helpers';
import { Prisma } from '@prisma/client';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import {
  buildAccessiblePatientsWhere,
  buildEncounterTaskScopeWhere,
  buildPatientProblemScopeWhere,
  isClinicalRecordInMedicoScope,
  isPatientOwnedByMedico,
} from '../common/utils/patient-access';
import { PATIENT_HISTORY_FIELD_KEYS, sanitizePatientHistoryFieldValue } from '../common/utils/patient-history';
import { isDateOnlyBeforeToday, parseDateOnlyToStoredUtcDate, startOfUtcDay, isDateOnlyAfterToday, calculateAgeFromBirthDate } from '../common/utils/local-date';
import { PatientCompletenessStatus } from '../common/types';
import { getPatientDemographicsMissingFields } from '../common/utils/patient-completeness';
import {
  formatTask,
  formatProblem,
  decoratePatient,
  formatAdminSummary,
  resolvePatientVerificationState,
  normalizeNullableString,
  matchesClinicalSearch,
  toCsvCell,
  formatEncounterTimelineItem,
  buildClinicalSummary,
} from './patients-format';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async findDuplicateRut(params: { rut: string; excludePatientId?: string }) {
    const { rut, excludePatientId } = params;

    return this.prisma.patient.findFirst({
      where: {
        rut,
        ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
      },
    });
  }

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
    // Validate RUT if provided
    let formattedRut: string | undefined = undefined;
    const trimmedRutExemptReason = createPatientDto.rutExemptReason?.trim();

    if (createPatientDto.rut && !createPatientDto.rutExempt) {
      const rutValidation = validateRut(createPatientDto.rut);
      if (!rutValidation.valid) {
        throw new BadRequestException('El RUT ingresado no es válido');
      }

      const validatedRut = rutValidation.formatted as string;

      const existingPatient = await this.findDuplicateRut({
        rut: validatedRut,
      });
      if (existingPatient) {
        throw new ConflictException('Ya existe un paciente con este RUT');
      }

      formattedRut = validatedRut;
    }

    // If exempt, require reason
    if (createPatientDto.rutExempt && !trimmedRutExemptReason) {
      throw new BadRequestException('Debe indicar el motivo de exención de RUT');
    }

    const verificationState = resolvePatientVerificationState({
      actorId: userId,
      actorRole: 'MEDICO',
      mode: 'CREATE_FULL',
      nextPatient: {
        rut: createPatientDto.rutExempt ? null : formattedRut || createPatientDto.rut || null,
        rutExempt: createPatientDto.rutExempt || false,
        rutExemptReason: trimmedRutExemptReason || null,
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
        rut: createPatientDto.rutExempt ? null : formattedRut || createPatientDto.rut || null,
        rutExempt: createPatientDto.rutExempt || false,
        rutExemptReason: trimmedRutExemptReason || null,
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
    // Validate RUT if provided
    let formattedRut: string | undefined = undefined;
    const trimmedRutExemptReason = createPatientDto.rutExemptReason?.trim();

    if (createPatientDto.rut && !createPatientDto.rutExempt) {
      const rutValidation = validateRut(createPatientDto.rut);
      if (!rutValidation.valid) {
        throw new BadRequestException('El RUT ingresado no es valido');
      }

      const validatedRut = rutValidation.formatted as string;

      const existingPatient = await this.findDuplicateRut({
        rut: validatedRut,
      });
      if (existingPatient) {
        throw new ConflictException('Ya existe un paciente con este RUT');
      }

      formattedRut = validatedRut;
    }

    if (createPatientDto.rutExempt && !trimmedRutExemptReason) {
      throw new BadRequestException('Debe indicar el motivo de exencion de RUT');
    }

    const patient = await this.prisma.patient.create({
      data: {
        createdById: user.id,
        rut: createPatientDto.rutExempt ? null : formattedRut || createPatientDto.rut || null,
        rutExempt: createPatientDto.rutExempt || false,
        rutExemptReason: trimmedRutExemptReason || null,
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
            rut: createPatientDto.rutExempt ? null : formattedRut || createPatientDto.rut || null,
            rutExempt: createPatientDto.rutExempt || false,
            rutExemptReason: trimmedRutExemptReason || null,
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
    filters?: {
      sexo?: string;
      prevision?: string;
      completenessStatus?: PatientCompletenessStatus;
      edadMin?: number;
      edadMax?: number;
      clinicalSearch?: string;
      sortBy?: 'nombre' | 'edad' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const skip = (page - 1) * limit;
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const normalizedClinicalSearch = filters?.clinicalSearch?.trim().toLowerCase();

    const baseWhere: Prisma.PatientWhereInput = {
      ...buildAccessiblePatientsWhere(user),
      ...(search
        ? {
            AND: [
              {
                OR: [{ nombre: { contains: search } }, { rut: { contains: search } }],
              },
            ],
          }
        : {}),
    };

    if (filters?.sexo) baseWhere.sexo = filters.sexo;
    if (filters?.prevision) baseWhere.prevision = filters.prevision;
    if (filters?.edadMin !== undefined || filters?.edadMax !== undefined) {
      const ageFilter: Prisma.IntNullableFilter = {};
      if (filters.edadMin !== undefined) ageFilter.gte = filters.edadMin;
      if (filters.edadMax !== undefined) ageFilter.lte = filters.edadMax;
      baseWhere.edad = ageFilter;
    }

    const where: Prisma.PatientWhereInput = filters?.completenessStatus
      ? {
          ...baseWhere,
          completenessStatus: filters.completenessStatus,
        }
      : baseWhere;

    const orderBy = filters?.sortBy ? { [filters.sortBy]: filters.sortOrder || 'asc' } : { createdAt: 'desc' as const };

    if (normalizedClinicalSearch) {
      const CLINICAL_SEARCH_CAP = 500;
      const patients = await this.prisma.patient.findMany({
        where,
        orderBy,
        take: CLINICAL_SEARCH_CAP,
        include: {
          _count: {
            select: { encounters: true },
          },
          encounters: {
            where: user.isAdmin ? undefined : { medicoId: effectiveMedicoId },
            select: {
              sections: {
                where: {
                  sectionKey: {
                    in: ['MOTIVO_CONSULTA', 'ANAMNESIS_PROXIMA', 'REVISION_SISTEMAS'],
                  },
                },
                select: { data: true },
              },
            },
          },
        },
      });

      const filteredPatients = patients
        .filter((patient) =>
          patient.encounters.some((encounter) =>
            encounter.sections.some((section) => matchesClinicalSearch(section.data, normalizedClinicalSearch)),
          ),
        )
        .map(({ encounters: _encounters, ...patient }) => patient);

      const paginatedPatients = filteredPatients.slice(skip, skip + limit);
      const incompleteCount = filteredPatients.filter((patient) => patient.completenessStatus === 'INCOMPLETA').length;
      const pendingVerificationCount = filteredPatients.filter(
        (patient) => patient.completenessStatus === 'PENDIENTE_VERIFICACION',
      ).length;
      const verifiedCount = filteredPatients.filter((patient) => patient.completenessStatus === 'VERIFICADA').length;

      return {
        data: paginatedPatients.map((patient) => decoratePatient(patient)),
        summary: {
          totalPatients: filteredPatients.length,
          incomplete: incompleteCount,
          pendingVerification: pendingVerificationCount,
          verified: verifiedCount,
          nonVerified: incompleteCount + pendingVerificationCount,
        },
        pagination: {
          page,
          limit,
          total: filteredPatients.length,
          totalPages: Math.ceil(filteredPatients.length / limit),
          clinicalSearchCapped: patients.length >= CLINICAL_SEARCH_CAP,
        },
      };
    }

    const [patients, total, incompleteCount, pendingVerificationCount, verifiedCount] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { encounters: true },
          },
        },
      }),
      this.prisma.patient.count({ where }),
      this.prisma.patient.count({ where: { ...baseWhere, completenessStatus: 'INCOMPLETA' } }),
      this.prisma.patient.count({ where: { ...baseWhere, completenessStatus: 'PENDIENTE_VERIFICACION' } }),
      this.prisma.patient.count({ where: { ...baseWhere, completenessStatus: 'VERIFICADA' } }),
    ]);

    return {
      data: patients.map((patient) => decoratePatient(patient)),
      summary: {
        totalPatients: incompleteCount + pendingVerificationCount + verifiedCount,
        incomplete: incompleteCount,
        pendingVerification: pendingVerificationCount,
        verified: verifiedCount,
        nonVerified: incompleteCount + pendingVerificationCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    const patients = await this.prisma.patient.findMany({
      where: { archivedAt: null },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { encounters: true } } },
    });

    const header =
      'Nombre,RUT,Edad,Sexo,Previsión,Modo registro,Estado completitud,Trabajo,Domicilio,Atenciones,Creado';
    const rows = patients.map((p) => {
      const fields = [
        toCsvCell(p.nombre || ''),
        toCsvCell(p.rut),
        toCsvCell(p.edad),
        toCsvCell(p.sexo),
        toCsvCell(p.prevision),
        toCsvCell(p.registrationMode),
        toCsvCell(p.completenessStatus),
        toCsvCell(p.trabajo),
        toCsvCell(p.domicilio),
        toCsvCell(p._count.encounters),
        toCsvCell(p.createdAt.toISOString().slice(0, 10)),
      ];
      return fields.join(',');
    });

    await this.auditService.log({
      entityType: 'PatientExport',
      entityId: 'csv',
      userId: user.id,
      action: 'EXPORT',
      diff: {
        export: {
          format: 'csv',
          patientCount: patients.length,
        },
      },
    });

    return '\uFEFF' + header + '\n' + rows.join('\n');
  }

  async getAdminSummary(user: RequestUser, id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      select: {
        id: true,
        rut: true,
        rutExempt: true,
        rutExemptReason: true,
        nombre: true,
        fechaNacimiento: true,
        edad: true,
        edadMeses: true,
        sexo: true,
        trabajo: true,
        prevision: true,
        registrationMode: true,
        completenessStatus: true,
        demographicsVerifiedAt: true,
        demographicsVerifiedById: true,
        domicilio: true,
        centroMedico: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        createdBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
        _count: {
          select: {
            encounters: true,
          },
        },
        encounters: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            createdAt: true,
          },
        },
      },
    });

    if (!patient || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    return formatAdminSummary(patient);
  }

  async findById(user: RequestUser, id: string) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        history: true,
        problems: {
          where: user.isAdmin ? undefined : buildPatientProblemScopeWhere(effectiveMedicoId),
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          include: {
            encounter: {
              select: { id: true, createdAt: true, status: true },
            },
            createdBy: {
              select: { id: true, nombre: true },
            },
          },
        },
        tasks: {
          where: user.isAdmin ? undefined : buildEncounterTaskScopeWhere(effectiveMedicoId),
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
          include: {
            createdBy: {
              select: { id: true, nombre: true },
            },
          },
        },
        createdBy: {
          select: { medicoId: true },
        },
      },
    });

    if (!patient || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    // Verify access: user created patient or has encounters with them
    if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
      const hasEncounter = await this.prisma.encounter.findFirst({
        where: { patientId: id, medicoId: effectiveMedicoId },
        select: { id: true },
      });
      if (!hasEncounter) {
        throw new NotFoundException('Paciente no encontrado');
      }
    }

    return decoratePatient(patient);
  }

  async findEncounterTimeline(user: RequestUser, patientId: string, page = 1, limit = 10) {
    await this.assertPatientAccess(user, patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const skip = (page - 1) * limit;
    const where = {
      patientId,
      medicoId: effectiveMedicoId,
    };

    const [encounters, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, nombre: true, email: true },
          },
          reviewRequestedBy: {
            select: { id: true, nombre: true },
          },
          reviewedBy: {
            select: { id: true, nombre: true },
          },
          completedBy: {
            select: { id: true, nombre: true },
          },
          tasks: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
              createdBy: {
                select: { id: true, nombre: true },
              },
            },
          },
          sections: {
            select: {
              id: true,
              encounterId: true,
              sectionKey: true,
              data: true,
              schemaVersion: true,
              completed: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.encounter.count({ where }),
    ]);

    return {
      data: encounters.map((encounter) => formatEncounterTimelineItem(encounter)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getClinicalSummary(
    user: RequestUser,
    patientId: string,
    options?: { fullVitalHistory?: boolean },
  ) {
    await this.assertPatientAccess(user, patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const fullVitals = options?.fullVitalHistory === true;

    const [patient, encounters, activeProblemsCount, pendingTasksCount, totalEncounters] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: {
          id: true,
          problems: {
            where: {
              ...(user.isAdmin ? {} : buildPatientProblemScopeWhere(effectiveMedicoId)),
              status: {
                not: 'RESUELTO',
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              label: true,
              status: true,
              severity: true,
              updatedAt: true,
            },
          },
          tasks: {
            where: {
              ...(user.isAdmin ? {} : buildEncounterTaskScopeWhere(effectiveMedicoId)),
              status: {
                notIn: ['COMPLETADA', 'CANCELADA'],
              },
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
            take: 5,
            select: {
              id: true,
              title: true,
              status: true,
              type: true,
              dueDate: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.encounter.findMany({
        where: {
          patientId,
          medicoId: effectiveMedicoId,
        },
        orderBy: { createdAt: 'desc' },
        ...(fullVitals ? {} : { take: 12 }),
        select: {
          id: true,
          createdAt: true,
          sections: {
            select: {
              sectionKey: true,
              data: true,
              schemaVersion: true,
            },
          },
        },
      }),
      this.prisma.patientProblem.count({
        where: {
          patientId,
          ...(user.isAdmin ? {} : buildPatientProblemScopeWhere(effectiveMedicoId)),
          status: {
            not: 'RESUELTO',
          },
        },
      }),
      this.prisma.encounterTask.count({
        where: {
          patientId,
          ...(user.isAdmin ? {} : buildEncounterTaskScopeWhere(effectiveMedicoId)),
          status: {
            notIn: ['COMPLETADA', 'CANCELADA'],
          },
        },
      }),
      this.prisma.encounter.count({
        where: {
          patientId,
          medicoId: effectiveMedicoId,
        },
      }),
    ]);

    return buildClinicalSummary(encounters, patient, {
      totalEncounters,
      activeProblems: activeProblemsCount,
      pendingTasks: pendingTasksCount,
    }, { fullVitals });
  }

  async findTasks(
    user: RequestUser,
    filters?: {
      search?: string;
      status?: string;
      type?: string;
      page?: number;
      limit?: number;
      overdueOnly?: boolean;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const effectiveMedicoId = getEffectiveMedicoId(user);
    const whereClauses: Prisma.EncounterTaskWhereInput[] = [
      {
        patient: {
          archivedAt: null,
        },
      },
    ];

    if (!user.isAdmin) {
      whereClauses.push(buildEncounterTaskScopeWhere(effectiveMedicoId));
    }

    if (filters?.status) {
      whereClauses.push({ status: filters.status });
    }

    if (filters?.type) {
      whereClauses.push({ type: filters.type });
    }

    if (filters?.search?.trim()) {
      const search = filters.search.trim();
      whereClauses.push({
        OR: [
          { title: { contains: search } },
          { details: { contains: search } },
          { patient: { nombre: { contains: search } } },
        ],
      });
    }

    if (filters?.overdueOnly) {
      whereClauses.push({ dueDate: { lt: startOfUtcDay(new Date()) } });
      if (filters?.status) {
        if (!['PENDIENTE', 'EN_PROCESO'].includes(filters.status)) {
          return {
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
            },
          };
        }
      } else {
        whereClauses.push({ status: { in: ['PENDIENTE', 'EN_PROCESO'] } });
      }
    }

    const where: Prisma.EncounterTaskWhereInput = whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

    const [tasks, total] = await Promise.all([
      this.prisma.encounterTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          patient: {
            select: { id: true, nombre: true, rut: true },
          },
          createdBy: {
            select: { id: true, nombre: true },
          },
        },
      }),
      this.prisma.encounterTask.count({ where }),
    ]);

    return {
      data: tasks.map((task) => ({
        ...formatTask(task),
        isOverdue: Boolean(
          task.dueDate && isDateOnlyBeforeToday(task.dueDate) && ['PENDIENTE', 'EN_PROCESO'].includes(task.status),
        ),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, user: RequestUser) {
    const existingPatient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { medicoId: true },
        },
      },
    });

    if (!existingPatient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (existingPatient.archivedAt) {
      throw new BadRequestException('No se puede editar un paciente archivado');
    }

    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && !isPatientOwnedByMedico(existingPatient, effectiveMedicoId)) {
      throw new ForbiddenException('No tiene permisos para editar este paciente');
    }

    // Prepare update data
    const updateData: Prisma.PatientUpdateInput = {};

    if (updatePatientDto.nombre !== undefined) {
      updateData.nombre = updatePatientDto.nombre.trim();
    }

    if (updatePatientDto.fechaNacimiento !== undefined) {
      if (updatePatientDto.fechaNacimiento && isDateOnlyAfterToday(updatePatientDto.fechaNacimiento)) {
        throw new BadRequestException('La fecha de nacimiento no puede ser futura');
      }
      updateData.fechaNacimiento = updatePatientDto.fechaNacimiento ? new Date(updatePatientDto.fechaNacimiento) : null;

      if (updatePatientDto.fechaNacimiento) {
        const recalc = calculateAgeFromBirthDate(updatePatientDto.fechaNacimiento);
        updateData.edad = recalc.edad;
        updateData.edadMeses = recalc.edadMeses;
      }
    }

    if (updatePatientDto.fechaNacimiento === undefined && updatePatientDto.edad !== undefined) {
      updateData.edad = updatePatientDto.edad;
    }

    if (updatePatientDto.fechaNacimiento === undefined && updatePatientDto.edadMeses !== undefined) {
      updateData.edadMeses = updatePatientDto.edadMeses;
    }

    if (updatePatientDto.sexo !== undefined) {
      updateData.sexo = updatePatientDto.sexo;
    }

    if (updatePatientDto.prevision !== undefined) {
      updateData.prevision = updatePatientDto.prevision;
    }

    // Normalize optional strings
    const dtoTrabajo = updatePatientDto.trabajo;
    if (dtoTrabajo !== undefined) {
      updateData.trabajo = normalizeNullableString(dtoTrabajo);
    }

    const dtoDomicilio = updatePatientDto.domicilio;
    if (dtoDomicilio !== undefined) {
      updateData.domicilio = normalizeNullableString(dtoDomicilio);
    }

    // Handle RUT exemption rules consistently
    const dtoRutExempt = updatePatientDto.rutExempt;
    const dtoRutExemptReason = updatePatientDto.rutExemptReason;
    const nextRutExempt = dtoRutExempt !== undefined ? dtoRutExempt : existingPatient.rutExempt;

    if (nextRutExempt) {
      const reason = (dtoRutExemptReason ?? existingPatient.rutExemptReason ?? '').trim();
      if (!reason) {
        throw new BadRequestException('Debe indicar el motivo de exención de RUT');
      }

      const dtoRut = updatePatientDto.rut;
      if (dtoRut && dtoRut.trim().length > 0) {
        throw new BadRequestException('No puede indicar RUT si el paciente está marcado como sin RUT');
      }

      updateData.rut = null;
      updateData.rutExempt = true;
      updateData.rutExemptReason = reason;
    } else {
      // If explicitly un-exempting, clear reason
      if (dtoRutExempt === false) {
        updateData.rutExemptReason = null;
      }
    }

    // Validate new RUT if changing (only when not exempt)
    const dtoRut = updatePatientDto.rut;
    if (!nextRutExempt && dtoRut !== undefined) {
      const trimmedRut = dtoRut?.trim() || '';

      if (!trimmedRut) {
        updateData.rut = null;
      } else if (trimmedRut !== existingPatient.rut) {
        const rutValidation = validateRut(trimmedRut);
        if (!rutValidation.valid) {
          throw new BadRequestException('El RUT ingresado no es válido');
        }

        const validatedRut = rutValidation.formatted as string;

        const duplicateRut = await this.findDuplicateRut({
          rut: validatedRut,
          excludePatientId: id,
        });

        if (duplicateRut) {
          throw new ConflictException('Ya existe un paciente con este RUT');
        }

        updateData.rut = validatedRut;
      }
    }

    const nextPatient = {
      ...existingPatient,
      ...updateData,
    };

    Object.assign(
      updateData,
      resolvePatientVerificationState({
        currentPatient: existingPatient,
        nextPatient,
        actorId: user.id,
        actorRole: user.role,
        mode: 'UPDATE_FULL',
      }),
    );

    const patient = await this.prisma.patient.update({
      where: { id },
      data: updateData,
      include: { history: true },
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: patient.id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        before: existingPatient,
        after: patient,
      },
    });

    return decoratePatient(patient);
  }

  async updateAdminFields(user: RequestUser, patientId: string, dto: UpdatePatientAdminDto) {
    const existingPatient = await this.assertPatientAccess(user, patientId);

    const updateData: Prisma.PatientUpdateInput = {};
    if (dto.fechaNacimiento !== undefined) {
      if (dto.fechaNacimiento && isDateOnlyAfterToday(dto.fechaNacimiento)) {
        throw new BadRequestException('La fecha de nacimiento no puede ser futura');
      }
      updateData.fechaNacimiento = dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null;

      if (dto.fechaNacimiento) {
        const recalc = calculateAgeFromBirthDate(dto.fechaNacimiento);
        updateData.edad = recalc.edad;
        updateData.edadMeses = recalc.edadMeses;
      }
    }
    if (dto.fechaNacimiento === undefined && dto.edad !== undefined) updateData.edad = dto.edad;
    if (dto.fechaNacimiento === undefined && dto.edadMeses !== undefined) updateData.edadMeses = dto.edadMeses;
    if (dto.sexo !== undefined) updateData.sexo = dto.sexo;
    if (dto.prevision !== undefined) updateData.prevision = dto.prevision;
    if (dto.trabajo !== undefined) {
      updateData.trabajo = normalizeNullableString(dto.trabajo);
    }
    if (dto.domicilio !== undefined) {
      updateData.domicilio = normalizeNullableString(dto.domicilio);
    }

    const nextPatient = {
      ...existingPatient,
      ...updateData,
    };

    Object.assign(
      updateData,
      resolvePatientVerificationState({
        currentPatient: existingPatient,
        nextPatient,
        actorId: user.id,
        actorRole: user.role,
        mode: 'UPDATE_ADMIN',
      }),
    );

    const patient = await this.prisma.patient.update({
      where: { id: patientId },
      data: updateData,
      include: { history: true },
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: patient.id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        before: existingPatient,
        after: patient,
        scope: 'ADMIN_FIELDS',
      },
    });

    return decoratePatient(patient);
  }

  async verifyDemographics(user: RequestUser, patientId: string) {
    const patient = await this.assertPatientAccess(user, patientId);

    const missingFields = getPatientDemographicsMissingFields(patient);
    if (missingFields.length > 0) {
      throw new BadRequestException('No se puede verificar una ficha con datos demográficos incompletos');
    }

    const updatedPatient = await this.prisma.patient.update({
      where: { id: patientId },
      data: resolvePatientVerificationState({
        currentPatient: patient,
        nextPatient: patient,
        actorId: user.id,
        actorRole: user.role,
        mode: 'VERIFY',
      }),
      include: { history: true },
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: updatedPatient.id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        before: patient,
        after: updatedPatient,
        scope: 'VERIFY_DEMOGRAPHICS',
      },
    });

    return decoratePatient(updatedPatient);
  }

  async updateHistory(user: RequestUser, patientId: string, dto: UpdatePatientHistoryDto) {
    const patient = await this.assertPatientAccess(user, patientId);
    const dtoRecord = dto as Record<string, unknown>;

    const previousHistory = patient.history;

    const historyData: Record<string, string | null> = {};
    for (const key of PATIENT_HISTORY_FIELD_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(dtoRecord, key)) {
        continue;
      }

      const sanitized = sanitizePatientHistoryFieldValue(key, dtoRecord[key], {
        rejectUnknownKeys: true,
      });

      historyData[key] = sanitized ? JSON.stringify(sanitized) : null;
    }

    const history = await this.prisma.patientHistory.upsert({
      where: { patientId },
      update: historyData,
      create: {
        patientId,
        ...historyData,
      },
    });

    await this.auditService.log({
      entityType: 'PatientHistory',
      entityId: history.id,
      userId: user.id,
      action: previousHistory ? 'UPDATE' : 'CREATE',
      diff: {
        before: previousHistory,
        after: history,
      },
    });

    return history;
  }

  async remove(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { medicoId: true },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
      throw new ForbiddenException('No tiene permisos para archivar este paciente');
    }

    if (patient.archivedAt) {
      return { message: 'El paciente ya se encuentra archivado' };
    }

    const archivedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.encounter.updateMany({
        where: {
          patientId: id,
          status: 'EN_PROGRESO',
        },
        data: {
          status: 'CANCELADO',
        },
      }),
      this.prisma.patient.update({
        where: { id },
        data: {
          archivedAt,
          archivedById: user.id,
        },
      }),
    ]);

    await this.auditService.log({
      entityType: 'Patient',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        archivedAt: archivedAt.toISOString(),
        archivedById: user.id,
        previousStatus: patient,
      },
    });

    return { message: 'Paciente archivado correctamente' };
  }

  async restore(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { medicoId: true },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
      throw new ForbiddenException('No tiene permisos para restaurar este paciente');
    }

    if (!patient.archivedAt) {
      return { message: 'El paciente ya se encuentra activo' };
    }

    await this.prisma.patient.update({
      where: { id },
      data: {
        archivedAt: null,
        archivedById: null,
      },
    });

    await this.auditService.log({
      entityType: 'Patient',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        restoredAt: new Date().toISOString(),
        previousArchivedAt: patient.archivedAt.toISOString(),
        previousArchivedById: patient.archivedById,
      },
    });

    return { message: 'Paciente restaurado correctamente' };
  }

  async createProblem(user: RequestUser, patientId: string, dto: UpsertPatientProblemDto) {
    await this.assertPatientAccess(user, patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);

    let resolvedMedicoId = effectiveMedicoId;

    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: {
          id: dto.encounterId,
          patientId,
          ...(user.isAdmin ? {} : { medicoId: effectiveMedicoId }),
        },
      });

      if (!encounter) {
        throw new BadRequestException('La atención asociada no existe para este paciente');
      }

      resolvedMedicoId = encounter.medicoId;
    }

    const created = await this.prisma.patientProblem.create({
      data: {
        patientId,
        encounterId: dto.encounterId || null,
        createdById: user.id,
        medicoId: resolvedMedicoId,
        label: dto.label.trim(),
        status: dto.status || 'ACTIVO',
        notes: dto.notes?.trim() || null,
        severity: dto.severity?.trim() || null,
        onsetDate: dto.onsetDate ? parseDateOnlyToStoredUtcDate(dto.onsetDate, 'La fecha de inicio') : null,
      },
      include: {
        encounter: {
          select: { id: true, createdAt: true, status: true },
        },
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'PatientProblem',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      diff: { created },
    });

    return formatProblem(created);
  }

  async updateProblem(user: RequestUser, problemId: string, dto: UpdatePatientProblemDto) {
    const problem = await this.prisma.patientProblem.findUnique({
      where: { id: problemId },
      include: {
        patient: true,
        encounter: {
          select: { id: true, createdAt: true, status: true, medicoId: true },
        },
        createdBy: {
          select: { medicoId: true },
        },
      },
    });

    if (!problem || problem.patient.archivedAt) {
      throw new NotFoundException('Problema clínico no encontrado');
    }

    await this.assertPatientAccess(user, problem.patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && !isClinicalRecordInMedicoScope(problem, effectiveMedicoId)) {
      throw new NotFoundException('Problema clínico no encontrado');
    }

    const updated = await this.prisma.patientProblem.update({
      where: { id: problemId },
      data: {
        label: dto.label?.trim() || problem.label,
        status: dto.status || problem.status,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : problem.notes,
        severity: dto.severity !== undefined ? dto.severity.trim() || null : problem.severity,
        onsetDate:
          dto.onsetDate !== undefined
            ? dto.onsetDate
              ? parseDateOnlyToStoredUtcDate(dto.onsetDate, 'La fecha de inicio')
              : null
            : problem.onsetDate,
        resolvedAt: dto.status === 'RESUELTO' ? new Date() : dto.status ? null : problem.resolvedAt,
      },
      include: {
        encounter: {
          select: { id: true, createdAt: true, status: true },
        },
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'PatientProblem',
      entityId: updated.id,
      userId: user.id,
      action: 'UPDATE',
      diff: { before: problem, after: updated },
    });

    return formatProblem(updated);
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
    await this.assertPatientAccess(user, patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);

    let resolvedMedicoId = effectiveMedicoId;

    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: {
          id: dto.encounterId,
          patientId,
          ...(user.isAdmin ? {} : { medicoId: effectiveMedicoId }),
        },
      });

      if (!encounter) {
        throw new BadRequestException('La atención asociada no existe para este paciente');
      }

      resolvedMedicoId = encounter.medicoId;
    }

    const created = await this.prisma.encounterTask.create({
      data: {
        patientId,
        encounterId: dto.encounterId || null,
        createdById: user.id,
        medicoId: resolvedMedicoId,
        title: dto.title.trim(),
        details: dto.details?.trim() || null,
        type: dto.type || 'SEGUIMIENTO',
        priority: dto.priority || 'MEDIA',
        status: dto.status || 'PENDIENTE',
        dueDate: dto.dueDate ? parseDateOnlyToStoredUtcDate(dto.dueDate, 'La fecha de vencimiento') : null,
      },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'EncounterTask',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      diff: { created },
    });

    return formatTask(created);
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
    const task = await this.prisma.encounterTask.findUnique({
      where: { id: taskId },
      include: {
        patient: true,
        encounter: {
          select: { medicoId: true },
        },
        createdBy: {
          select: { id: true, nombre: true, medicoId: true },
        },
      },
    });

    if (!task || task.patient.archivedAt) {
      throw new NotFoundException('Seguimiento no encontrado');
    }

    await this.assertPatientAccess(user, task.patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && !isClinicalRecordInMedicoScope(task, effectiveMedicoId)) {
      throw new NotFoundException('Seguimiento no encontrado');
    }

    const updated = await this.prisma.encounterTask.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim() || task.title,
        status: dto.status || task.status,
        details: dto.details !== undefined ? dto.details.trim() || null : task.details,
        type: dto.type || task.type,
        priority: dto.priority || task.priority,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate
              ? parseDateOnlyToStoredUtcDate(dto.dueDate, 'La fecha de vencimiento')
              : null
            : task.dueDate,
        completedAt:
          dto.status === 'COMPLETADA'
            ? new Date()
            : dto.status && dto.status !== 'COMPLETADA'
              ? null
              : task.completedAt,
      },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    await this.auditService.log({
      entityType: 'EncounterTask',
      entityId: updated.id,
      userId: user.id,
      action: 'UPDATE',
      diff: { before: task, after: updated },
    });

    return formatTask(updated);
  }
}
