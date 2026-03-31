import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { validateRut } from '../common/utils/helpers';
import { Prisma } from '@prisma/client';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { parseStoredJson } from '../common/utils/encounter-sections';
import { PATIENT_HISTORY_FIELD_KEYS, sanitizePatientHistoryFieldValue } from '../common/utils/patient-history';
import { isDateOnlyBeforeToday, parseDateOnlyToStoredUtcDate, startOfUtcDay } from '../common/utils/local-date';
import {
  ENCOUNTER_SECTION_LABELS,
  ENCOUNTER_SECTION_ORDER,
} from '../common/utils/encounter-section-meta';
import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async findDuplicateRut(params: {
    rut: string;
    excludePatientId?: string;
  }) {
    const { rut, excludePatientId } = params;

    return this.prisma.patient.findFirst({
      where: {
        rut,
        ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
      },
    });
  }

  private formatTask(task: any) {
    return {
      ...task,
      createdBy: task.createdBy ? { id: task.createdBy.id, nombre: task.createdBy.nombre } : undefined,
    };
  }

  private formatProblem(problem: any) {
    return {
      ...problem,
      encounter: problem.encounter
        ? {
            id: problem.encounter.id,
            createdAt: problem.encounter.createdAt,
            status: problem.encounter.status,
          }
        : null,
    };
  }

  private async assertPatientAccess(user: RequestUser, patientId: string) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { history: true },
    });

    if (!patient || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    // Allow access if user created the patient or has encounters with them
    if (!user.isAdmin && patient.createdById !== effectiveMedicoId) {
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

    const patient = await this.prisma.patient.create({
      data: {
        createdById: userId,
        rut: createPatientDto.rutExempt ? null : (formattedRut || createPatientDto.rut || null),
        rutExempt: createPatientDto.rutExempt || false,
        rutExemptReason: trimmedRutExemptReason || null,
        nombre: createPatientDto.nombre,
        edad: createPatientDto.edad,
        sexo: createPatientDto.sexo,
        trabajo: createPatientDto.trabajo,
        prevision: createPatientDto.prevision,
        domicilio: createPatientDto.domicilio,
        history: {
          create: {}, // Create empty history record
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

    return patient;
  }

  async createQuick(createPatientDto: CreatePatientQuickDto, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

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
        createdById: effectiveMedicoId,
        rut: createPatientDto.rutExempt ? null : (formattedRut || createPatientDto.rut || null),
        rutExempt: createPatientDto.rutExempt || false,
        rutExemptReason: trimmedRutExemptReason || null,
        nombre: createPatientDto.nombre,
        edad: 0,
        sexo: 'PREFIERE_NO_DECIR',
        prevision: 'DESCONOCIDA',
        trabajo: null,
        domicilio: null,
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

    return patient;
  }


  async findAll(
    user: RequestUser,
    search?: string,
    page = 1,
    limit = 20,
    filters?: {
      sexo?: string;
      prevision?: string;
      edadMin?: number;
      edadMax?: number;
      sortBy?: 'nombre' | 'edad' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const skip = (page - 1) * limit;
    const effectiveMedicoId = getEffectiveMedicoId(user);

    // Scope: patients created by this medico OR with at least one encounter by them
    const accessFilter: any = user.isAdmin
      ? {}
      : {
          OR: [
            { createdById: effectiveMedicoId },
            { encounters: { some: { medicoId: effectiveMedicoId } } },
          ],
        };

    const where: any = {
      archivedAt: null,
      ...accessFilter,
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { nombre: { contains: search } },
                  { rut: { contains: search } },
                ],
              },
            ],
          }
        : {}),
    };

    if (filters?.sexo) where.sexo = filters.sexo;
    if (filters?.prevision) where.prevision = filters.prevision;
    if (filters?.edadMin !== undefined || filters?.edadMax !== undefined) {
      where.edad = {};
      if (filters.edadMin !== undefined) where.edad.gte = filters.edadMin;
      if (filters.edadMax !== undefined) where.edad.lte = filters.edadMax;
    }

    const orderBy = filters?.sortBy
      ? { [filters.sortBy]: filters.sortOrder || 'asc' }
      : { createdAt: 'desc' as const };

    const [patients, total] = await Promise.all([
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
    ]);

    return {
      data: patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private formatEncounterTimelineItem(encounter: any) {
    const sortedSections = [...(encounter.sections || [])].sort((a: any, b: any) => {
      return ENCOUNTER_SECTION_ORDER.indexOf(a.sectionKey as SectionKey)
        - ENCOUNTER_SECTION_ORDER.indexOf(b.sectionKey as SectionKey);
    });

    return {
      id: encounter.id,
      patientId: encounter.patientId,
      createdById: encounter.createdById,
      status: encounter.status,
      reviewStatus: encounter.reviewStatus,
      reviewRequestedAt: encounter.reviewRequestedAt,
      reviewNote: encounter.reviewNote,
      reviewedAt: encounter.reviewedAt,
      completedAt: encounter.completedAt,
      closureNote: encounter.closureNote,
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
      createdBy: encounter.createdBy,
      reviewRequestedBy: encounter.reviewRequestedBy,
      reviewedBy: encounter.reviewedBy,
      completedBy: encounter.completedBy,
      tasks: (encounter.tasks || []).map((task: any) => this.formatTask(task)),
      progress: {
        completed: sortedSections.filter((section) => section.completed).length,
        total: ENCOUNTER_SECTION_ORDER.length,
      },
      sections: sortedSections.map((section: any) => ({
        ...formatEncounterSectionForRead({
          ...section,
          data: parseStoredJson(section.data, {}),
        }),
        label: ENCOUNTER_SECTION_LABELS[section.sectionKey as SectionKey],
        order: ENCOUNTER_SECTION_ORDER.indexOf(section.sectionKey as SectionKey),
      })),
    };
  }

  private getEncounterSectionData<T extends Record<string, unknown>>(encounter: any, sectionKey: SectionKey) {
    const section = (encounter.sections || []).find((item: any) => item.sectionKey === sectionKey);
    if (!section) {
      return {} as T;
    }

    return formatEncounterSectionForRead(section).data as T;
  }

  private buildEncounterSummaryLines(encounter: any) {
    const motivo = this.getEncounterSectionData<{ texto?: string }>(encounter, 'MOTIVO_CONSULTA');
    const diagnostico = this.getEncounterSectionData<{ sospechas?: Array<{ diagnostico?: string }> }>(encounter, 'SOSPECHA_DIAGNOSTICA');
    const tratamiento = this.getEncounterSectionData<{ plan?: string }>(encounter, 'TRATAMIENTO');
    const respuesta = this.getEncounterSectionData<{ planSeguimiento?: string }>(encounter, 'RESPUESTA_TRATAMIENTO');
    const observaciones = this.getEncounterSectionData<{ resumenClinico?: string }>(encounter, 'OBSERVACIONES');

    const lines = [
      motivo.texto?.trim(),
      diagnostico.sospechas?.length
        ? `Dx: ${diagnostico.sospechas
            .slice(0, 3)
            .map((item) => item.diagnostico?.trim())
            .filter(Boolean)
            .join(', ')}`
        : '',
      tratamiento.plan?.trim() ? `Plan: ${tratamiento.plan.trim()}` : '',
      respuesta.planSeguimiento?.trim() ? `Seguimiento: ${respuesta.planSeguimiento.trim()}` : '',
      observaciones.resumenClinico?.trim() ? `Resumen: ${observaciones.resumenClinico.trim()}` : '',
    ].filter((value): value is string => Boolean(value));

    return lines.slice(0, 4);
  }

  private buildClinicalSummary(encounters: any[], patient: any, counts: {
    totalEncounters: number;
    activeProblems: number;
    pendingTasks: number;
  }) {
    const diagnosisMap = new Map<string, { label: string; count: number; lastSeenAt: Date }>();
    const vitalTrend = encounters
      .map((encounter) => {
        const examen = this.getEncounterSectionData<{
          signosVitales?: Record<string, unknown>;
        }>(encounter, 'EXAMEN_FISICO');
        const signos = examen.signosVitales;

        if (!signos || typeof signos !== 'object') {
          return null;
        }

        return {
          encounterId: encounter.id,
          createdAt: encounter.createdAt,
          presionArterial: typeof signos.presionArterial === 'string' ? signos.presionArterial : null,
          peso: signos.peso ? Number(signos.peso) : null,
          imc: signos.imc ? Number(signos.imc) : null,
          temperatura: signos.temperatura ? Number(signos.temperatura) : null,
          saturacionOxigeno: signos.saturacionOxigeno ? Number(signos.saturacionOxigeno) : null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => item.presionArterial || item.peso !== null || item.imc !== null || item.temperatura !== null || item.saturacionOxigeno !== null)
      .slice(0, 6);

    for (const encounter of encounters) {
      const diagnostico = this.getEncounterSectionData<{
        sospechas?: Array<{ diagnostico?: string }>;
      }>(encounter, 'SOSPECHA_DIAGNOSTICA');

      for (const sospecha of diagnostico.sospechas || []) {
        const label = sospecha.diagnostico?.trim();
        if (!label) {
          continue;
        }

        const normalizedLabel = label.toLowerCase();
        const existing = diagnosisMap.get(normalizedLabel);
        if (existing) {
          existing.count += 1;
          if (encounter.createdAt > existing.lastSeenAt) {
            existing.lastSeenAt = encounter.createdAt;
          }
          continue;
        }

        diagnosisMap.set(normalizedLabel, {
          label,
          count: 1,
          lastSeenAt: encounter.createdAt,
        });
      }
    }

    const recentDiagnoses = [...diagnosisMap.values()]
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
      })
      .slice(0, 5)
      .map((item) => ({
        label: item.label,
        count: item.count,
        lastSeenAt: item.lastSeenAt,
      }));

    return {
      patientId: patient.id,
      generatedAt: new Date().toISOString(),
      counts,
      latestEncounterSummary: encounters[0]
        ? {
            encounterId: encounters[0].id,
            createdAt: encounters[0].createdAt,
            lines: this.buildEncounterSummaryLines(encounters[0]),
          }
        : null,
      vitalTrend,
      recentDiagnoses,
      activeProblems: patient.problems.map((problem: any) => ({
        id: problem.id,
        label: problem.label,
        status: problem.status,
        severity: problem.severity,
        updatedAt: problem.updatedAt,
      })),
      pendingTasks: patient.tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        type: task.type,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
      })),
    };
  }

  async exportCsv(user: RequestUser) {
    const patients = await this.prisma.patient.findMany({
      where: { archivedAt: null },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { encounters: true } } },
    });

    const header = 'Nombre,RUT,Edad,Sexo,Previsión,Trabajo,Domicilio,Atenciones,Creado';
    const rows = patients.map((p) => {
      const fields = [
        `"${(p.nombre || '').replace(/"/g, '""')}"`,
        p.rut || '-',
        p.edad,
        p.sexo,
        p.prevision,
        `"${(p.trabajo || '-').replace(/"/g, '""')}"`,
        `"${(p.domicilio || '-').replace(/"/g, '""')}"`,
        p._count.encounters,
        p.createdAt.toISOString().slice(0, 10),
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

  async findById(user: RequestUser, id: string) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        history: true,
        problems: {
          orderBy: [
            { status: 'asc' },
            { updatedAt: 'desc' },
          ],
          include: {
            encounter: {
              select: { id: true, createdAt: true, status: true },
            },
          },
        },
        tasks: {
          orderBy: [
            { status: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'desc' },
          ],
          include: {
            createdBy: {
              select: { id: true, nombre: true },
            },
          },
        },
      },
    });

    if (!patient || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    // Verify access: user created patient or has encounters with them
    if (!user.isAdmin && patient.createdById !== effectiveMedicoId) {
      const hasEncounter = await this.prisma.encounter.findFirst({
        where: { patientId: id, medicoId: effectiveMedicoId },
        select: { id: true },
      });
      if (!hasEncounter) {
        throw new NotFoundException('Paciente no encontrado');
      }
    }

    return {
      ...patient,
      problems: patient.problems.map((problem) => this.formatProblem(problem)),
      tasks: patient.tasks.map((task) => this.formatTask(task)),
    };
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
      data: encounters.map((encounter) => this.formatEncounterTimelineItem(encounter)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getClinicalSummary(user: RequestUser, patientId: string) {
    await this.assertPatientAccess(user, patientId);
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const [patient, encounters, activeProblemsCount, pendingTasksCount, totalEncounters] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: {
          id: true,
          problems: {
            where: {
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
        take: 12,
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
          status: {
            not: 'RESUELTO',
          },
        },
      }),
      this.prisma.encounterTask.count({
        where: {
          patientId,
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

    return this.buildClinicalSummary(encounters, patient, {
      totalEncounters,
      activeProblems: activeProblemsCount,
      pendingTasks: pendingTasksCount,
    });
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

    const where: Prisma.EncounterTaskWhereInput = {
      patient: {
        archivedAt: null,
        ...(user.isAdmin
          ? {}
          : {
              OR: [
                { createdById: effectiveMedicoId },
                { encounters: { some: { medicoId: effectiveMedicoId } } },
              ],
            }),
      },
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.search?.trim()) {
      where.OR = [
        { title: { contains: filters.search.trim() } },
        { details: { contains: filters.search.trim() } },
        { patient: { nombre: { contains: filters.search.trim() } } },
      ];
    }

    if (filters?.overdueOnly) {
      where.dueDate = { lt: startOfUtcDay(new Date()) };
      where.status = { in: ['PENDIENTE', 'EN_PROCESO'] } as any;
    }

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
        ...this.formatTask(task),
        isOverdue: Boolean(
          task.dueDate
          && isDateOnlyBeforeToday(task.dueDate)
          && ['PENDIENTE', 'EN_PROCESO'].includes(task.status),
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
    const existingPatient = await this.prisma.patient.findUnique({ where: { id } });

    if (!existingPatient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (existingPatient.archivedAt) {
      throw new BadRequestException('No se puede editar un paciente archivado');
    }

    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && existingPatient.createdById !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para editar este paciente');
    }

    // Prepare update data
    const updateData: Prisma.PatientUpdateInput = { ...updatePatientDto };

    // Normalize optional strings
    const dtoTrabajo = updatePatientDto.trabajo;
    if (dtoTrabajo !== undefined) {
      const trimmed = dtoTrabajo.trim();
      updateData.trabajo = trimmed.length > 0 ? trimmed : null;
    }

    const dtoDomicilio = updatePatientDto.domicilio;
    if (dtoDomicilio !== undefined) {
      const trimmed = dtoDomicilio.trim();
      updateData.domicilio = trimmed.length > 0 ? trimmed : null;
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
    if (!nextRutExempt && dtoRut && dtoRut !== existingPatient.rut) {
      const rutValidation = validateRut(dtoRut);
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

    return patient;
  }

  async updateAdminFields(user: RequestUser, patientId: string, dto: UpdatePatientAdminDto) {
    const existingPatient = await this.assertPatientAccess(user, patientId);

    const updateData: Prisma.PatientUpdateInput = {};
    if (dto.edad !== undefined) updateData.edad = dto.edad;
    if (dto.sexo !== undefined) updateData.sexo = dto.sexo;
    if (dto.prevision !== undefined) updateData.prevision = dto.prevision;
    if (dto.trabajo !== undefined) {
      const trimmed = dto.trabajo.trim();
      updateData.trabajo = trimmed.length > 0 ? trimmed : null;
    }
    if (dto.domicilio !== undefined) {
      const trimmed = dto.domicilio.trim();
      updateData.domicilio = trimmed.length > 0 ? trimmed : null;
    }

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

    return patient;
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
    const patient = await this.prisma.patient.findUnique({ where: { id } });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!user.isAdmin && patient.createdById !== effectiveMedicoId) {
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
    const patient = await this.prisma.patient.findUnique({ where: { id } });

    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!user.isAdmin && patient.createdById !== effectiveMedicoId) {
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

  async createProblem(
    user: RequestUser,
    patientId: string,
    dto: {
      label: string;
      status?: string;
      notes?: string;
      severity?: string;
      onsetDate?: string;
      encounterId?: string;
    },
  ) {
    await this.assertPatientAccess(user, patientId);

    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: {
          id: dto.encounterId,
          patientId,
        },
      });

      if (!encounter) {
        throw new BadRequestException('La atención asociada no existe para este paciente');
      }
    }

    const created = await this.prisma.patientProblem.create({
      data: {
        patientId,
        encounterId: dto.encounterId || null,
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
      },
    });

    await this.auditService.log({
      entityType: 'PatientProblem',
      entityId: created.id,
      userId: user.id,
      action: 'CREATE',
      diff: { created },
    });

    return this.formatProblem(created);
  }

  async updateProblem(
    user: RequestUser,
    problemId: string,
    dto: {
      label?: string;
      status?: string;
      notes?: string;
      severity?: string;
      onsetDate?: string;
    },
  ) {
    const problem = await this.prisma.patientProblem.findUnique({
      where: { id: problemId },
      include: {
        patient: true,
        encounter: {
          select: { id: true, createdAt: true, status: true },
        },
      },
    });

    if (!problem || problem.patient.archivedAt) {
      throw new NotFoundException('Problema clínico no encontrado');
    }

    await this.assertPatientAccess(user, problem.patientId);

    const updated = await this.prisma.patientProblem.update({
      where: { id: problemId },
      data: {
        label: dto.label?.trim() || problem.label,
        status: dto.status || problem.status,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : problem.notes,
        severity: dto.severity !== undefined ? dto.severity.trim() || null : problem.severity,
        onsetDate: dto.onsetDate !== undefined
          ? (dto.onsetDate ? parseDateOnlyToStoredUtcDate(dto.onsetDate, 'La fecha de inicio') : null)
          : problem.onsetDate,
        resolvedAt: dto.status === 'RESUELTO' ? new Date() : dto.status ? null : problem.resolvedAt,
      },
      include: {
        encounter: {
          select: { id: true, createdAt: true, status: true },
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

    return this.formatProblem(updated);
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

    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: {
          id: dto.encounterId,
          patientId,
        },
      });

      if (!encounter) {
        throw new BadRequestException('La atención asociada no existe para este paciente');
      }
    }

    const created = await this.prisma.encounterTask.create({
      data: {
        patientId,
        encounterId: dto.encounterId || null,
        createdById: user.id,
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

    return this.formatTask(created);
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
        createdBy: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!task || task.patient.archivedAt) {
      throw new NotFoundException('Seguimiento no encontrado');
    }

    await this.assertPatientAccess(user, task.patientId);

    const updated = await this.prisma.encounterTask.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim() || task.title,
        status: dto.status || task.status,
        details: dto.details !== undefined ? dto.details.trim() || null : task.details,
        type: dto.type || task.type,
        priority: dto.priority || task.priority,
        dueDate: dto.dueDate !== undefined
          ? (dto.dueDate ? parseDateOnlyToStoredUtcDate(dto.dueDate, 'La fecha de vencimiento') : null)
          : task.dueDate,
        completedAt: dto.status === 'COMPLETADA' ? new Date() : dto.status && dto.status !== 'COMPLETADA' ? null : task.completedAt,
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

    return this.formatTask(updated);
  }
}
