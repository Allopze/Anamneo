import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionKey, EncounterStatus } from '../common/types';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { parseStoredJson } from '../common/utils/encounter-sections';

// Section order for validation
const SECTION_ORDER: SectionKey[] = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'ANAMNESIS_PROXIMA',
  'ANAMNESIS_REMOTA',
  'REVISION_SISTEMAS',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
  'RESPUESTA_TRATAMIENTO',
  'OBSERVACIONES',
];

const SECTION_LABELS: Record<SectionKey, string> = {
  IDENTIFICACION: 'Identificación del paciente',
  MOTIVO_CONSULTA: 'Motivo de consulta',
  ANAMNESIS_PROXIMA: 'Anamnesis próxima',
  ANAMNESIS_REMOTA: 'Anamnesis remota',
  REVISION_SISTEMAS: 'Revisión por sistemas',
  EXAMEN_FISICO: 'Examen físico',
  SOSPECHA_DIAGNOSTICA: 'Sospecha diagnóstica',
  TRATAMIENTO: 'Tratamiento',
  RESPUESTA_TRATAMIENTO: 'Respuesta al tratamiento',
  OBSERVACIONES: 'Observaciones',
};

const REQUIRED_COMPLETION_SECTIONS: SectionKey[] = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

const REQUIRED_SEMANTIC_SECTIONS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

function parseSectionData(rawData: unknown): unknown {
  return parseStoredJson(rawData, null);
}

function hasMeaningfulContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulContent(item));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulContent(item));
  }

  return false;
}

@Injectable()
export class EncountersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private formatTask(task: any) {
    return {
      ...task,
      createdBy: task.createdBy ? { id: task.createdBy.id, nombre: task.createdBy.nombre } : undefined,
    };
  }

  async create(patientId: string, createDto: CreateEncounterDto, user: RequestUser) {
    let result:
      | (ReturnType<EncountersService['formatEncounter']> & { reused: boolean })
      | undefined;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) => {
            const effectiveMedicoId = getEffectiveMedicoId(user);
            // Verify patient exists
            const patient = await tx.patient.findUnique({
              where: { id: patientId },
              include: { history: true },
            });

            if (!patient) {
              throw new NotFoundException('Paciente no encontrado');
            }

            if (patient.medicoId !== effectiveMedicoId) {
              throw new ForbiddenException('No tiene permisos para crear una atención para este paciente');
            }

            if (patient.archivedAt) {
              throw new BadRequestException('No se puede crear una atención para un paciente archivado');
            }

            const inProgress = await tx.encounter.findMany({
              where: {
                patientId,
                status: 'EN_PROGRESO',
              },
              orderBy: { createdAt: 'desc' },
              include: {
                sections: { select: { completed: true } },
                patient: true,
                createdBy: { select: { id: true, nombre: true, email: true } },
              },
            });

            if (inProgress.length === 1) {
              return {
                ...this.formatEncounter(inProgress[0]),
                reused: true,
              };
            }

            if (inProgress.length > 1) {
              throw new ConflictException({
                message: 'Hay múltiples atenciones en progreso para este paciente. Selecciona cuál abrir.',
                inProgressEncounters: inProgress.map((enc) => ({
                  id: enc.id,
                  status: enc.status,
                  createdAt: enc.createdAt,
                  updatedAt: enc.updatedAt,
                  createdBy: enc.createdBy,
                  progress: {
                    completed: enc.sections.filter((s) => s.completed).length,
                    total: enc.sections.length,
                  },
                })),
              });
            }

            // Create encounter with initial sections
            const encounter = await tx.encounter.create({
              data: {
                patientId,
                createdById: user.id,
                status: 'EN_PROGRESO',
                sections: {
                  create: SECTION_ORDER.map((key) => {
                    const sectionData = key === 'IDENTIFICACION'
                      ? {
                          nombre: patient.nombre,
                          edad: patient.edad,
                          sexo: patient.sexo,
                          trabajo: patient.trabajo || '',
                          prevision: patient.prevision,
                          domicilio: patient.domicilio || '',
                          rut: patient.rut || '',
                          rutExempt: patient.rutExempt,
                          rutExemptReason: patient.rutExemptReason || '',
                        }
                      : key === 'ANAMNESIS_REMOTA' && patient.history
                      ? { ...patient.history, readonly: true }
                      : {};
                    return {
                      sectionKey: key,
                      data: JSON.stringify(sectionData),
                      completed: false,
                    };
                  }),
                },
              },
              include: {
                sections: true,
                patient: true,
                createdBy: {
                  select: { id: true, nombre: true, email: true },
                },
              },
            });
            return {
              ...this.formatEncounter(encounter),
              reused: false,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) {
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      throw new ConflictException('No se pudo crear la atención. Intente nuevamente.');
    }

    if (!result.reused) {
      await this.auditService.log({
        entityType: 'Encounter',
        entityId: result.id,
        userId: user.id,
        action: 'CREATE',
        diff: { patientId, status: 'EN_PROGRESO' },
      });
    }

    return result;
  }

  async findAll(
    user: RequestUser,
    status: EncounterStatus | undefined,
    search: string | undefined,
    reviewStatus: string | undefined,
    page = 1,
    limit = 15,
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const skip = (page - 1) * limit;

    const where: any = {
      patient: {
        medicoId: effectiveMedicoId,
        archivedAt: null,
      },
    };

    if (status && ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'].includes(status)) {
      where.status = status;
    }

    if (reviewStatus && ['NO_REQUIERE_REVISION', 'LISTA_PARA_REVISION', 'REVISADA_POR_MEDICO'].includes(reviewStatus)) {
      where.reviewStatus = reviewStatus;
    }

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      where.OR = [
        { patient: { nombre: { contains: trimmedSearch, mode: 'insensitive' } } },
        { patient: { rut: { contains: trimmedSearch, mode: 'insensitive' } } },
      ];
    }

    const [encounters, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: true,
          createdBy: {
            select: { id: true, nombre: true },
          },
          reviewedBy: {
            select: { id: true, nombre: true },
          },
          sections: {
            select: { completed: true },
          },
        },
      }),
      this.prisma.encounter.count({ where }),
    ]);

    return {
      data: encounters.map((enc) => ({
        ...enc,
        progress: {
          completed: enc.sections.filter((s) => s.completed).length,
          total: enc.sections.length,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  async findById(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id,
        patient: { medicoId: effectiveMedicoId },
      },
      include: {
        sections: {
          orderBy: { sectionKey: 'asc' },
        },
        patient: {
          include: {
            history: true,
            problems: {
              orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
            },
            tasks: {
              orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
              include: {
                createdBy: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        createdBy: {
          select: { id: true, nombre: true, email: true },
        },
        reviewedBy: {
          select: { id: true, nombre: true },
        },
        suggestions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        attachments: true,
        tasks: {
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
          include: {
            createdBy: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    return this.formatEncounter(encounter);
  }

  async findByPatient(patientId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const encounters = await this.prisma.encounter.findMany({
      where: {
        patientId,
        patient: {
          medicoId: effectiveMedicoId,
          archivedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
        sections: {
          select: { sectionKey: true, completed: true },
        },
      },
    });

    return encounters.map((enc) => ({
      ...enc,
      progress: {
        completed: enc.sections.filter((s) => s.completed).length,
        total: enc.sections.length,
      },
    }));
  }

  async updateSection(
    encounterId: string,
    sectionKey: SectionKey,
    dto: UpdateSectionDto,
    user: RequestUser,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { sections: true, patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    const effectiveMedicoId = getEffectiveMedicoId(user);

    if (encounter.patient.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para editar esta atención');
    }

    if (encounter.status === 'COMPLETADO') {
      throw new BadRequestException('No se puede editar una atención completada');
    }

    // Only creator or MEDICO can edit
    if (encounter.createdById !== user.id && user.role !== 'MEDICO') {
      throw new ForbiddenException('No tiene permisos para editar esta atención');
    }

    const section = encounter.sections.find((s) => s.sectionKey === sectionKey);
    if (!section) {
      throw new NotFoundException('Sección no encontrada');
    }

    const updatedSection = await this.prisma.encounterSection.update({
      where: { id: section.id },
      data: {
        data: JSON.stringify(dto.data),
        completed: dto.completed ?? section.completed,
      },
    });

    await this.auditService.log({
      entityType: 'EncounterSection',
      entityId: section.id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        sectionKey,
        data: JSON.stringify(dto.data),
        completed: dto.completed,
      },
    });

    return updatedSection;
  }

  async complete(id: string, userId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: { sections: true, patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.patient.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para completar esta atención');
    }

    const sectionByKey = new Map(encounter.sections.map((section) => [section.sectionKey as SectionKey, section]));

    const incompleteSections = REQUIRED_COMPLETION_SECTIONS.filter((key) => {
      const section = sectionByKey.get(key);
      return !section || !section.completed;
    });

    if (incompleteSections.length > 0) {
      throw new BadRequestException(
        `Las siguientes secciones obligatorias no están completas: ${incompleteSections
          .map((key) => SECTION_LABELS[key])
          .join(', ')}`,
      );
    }

    const semanticallyIncompleteSections = REQUIRED_SEMANTIC_SECTIONS.filter((key) => {
      const section = sectionByKey.get(key);
      if (!section) {
        return true;
      }

      return !hasMeaningfulContent(parseSectionData(section.data));
    });

    if (semanticallyIncompleteSections.length > 0) {
      throw new BadRequestException(
        `Las siguientes secciones obligatorias no tienen contenido clínico suficiente: ${semanticallyIncompleteSections
          .map((key) => SECTION_LABELS[key])
          .join(', ')}`,
      );
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'COMPLETADO',
        reviewStatus: 'REVISADA_POR_MEDICO',
        reviewedAt: new Date(),
        reviewedById: userId,
        completedAt: new Date(),
        completedById: userId,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: { status: 'COMPLETADO' },
    });

    return this.formatEncounter(updated);
  }

  async reopen(id: string, userId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.status !== 'COMPLETADO') {
      throw new BadRequestException('Solo se pueden reabrir atenciones completadas');
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'EN_PROGRESO',
        reviewStatus: 'NO_REQUIERE_REVISION',
        reviewRequestedAt: null,
        reviewedAt: null,
        reviewedById: null,
        completedAt: null,
        completedById: null,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: { status: 'EN_PROGRESO', reopenedBy: userId },
    });

    return this.formatEncounter(updated);
  }

  async cancel(id: string, userId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.patient.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para cancelar esta atención');
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: { status: 'CANCELADO' },
    });

    return updated;
  }

  async updateReviewStatus(
    id: string,
    user: RequestUser,
    reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO',
    note?: string,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.patient.medicoId !== getEffectiveMedicoId(user)) {
      throw new ForbiddenException('No tiene permisos para actualizar la revisión de esta atención');
    }

    if (reviewStatus === 'REVISADA_POR_MEDICO' && user.role !== 'MEDICO') {
      throw new ForbiddenException('Solo un médico puede marcar la atención como revisada');
    }

    if (reviewStatus === 'LISTA_PARA_REVISION' && user.role === 'MEDICO') {
      throw new BadRequestException('La revisión por médico debe marcarse como revisada, no como pendiente');
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        reviewStatus,
        reviewRequestedAt: reviewStatus === 'LISTA_PARA_REVISION' ? new Date() : null,
        reviewedAt: reviewStatus === 'REVISADA_POR_MEDICO' ? new Date() : null,
        reviewedById: reviewStatus === 'REVISADA_POR_MEDICO' ? user.id : null,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        tasks: {
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
          include: { createdBy: { select: { id: true, nombre: true } } },
        },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        reviewStatus,
        note: note?.trim() || null,
      },
    });

    return this.formatEncounter(updated);
  }

  async getDashboard(user: RequestUser) {
    const medicoId = getEffectiveMedicoId(user);
    const today = new Date();

    const where = medicoId
      ? {
          patient: {
            medicoId,
            archivedAt: null,
          },
        }
      : {};

    const [enProgreso, completado, cancelado, pendingReview, recent, upcomingTasks] = await Promise.all([
      this.prisma.encounter.count({ where: { ...where, status: 'EN_PROGRESO' } }),
      this.prisma.encounter.count({ where: { ...where, status: 'COMPLETADO' } }),
      this.prisma.encounter.count({ where: { ...where, status: 'CANCELADO' } }),
      this.prisma.encounter.count({ where: { ...where, reviewStatus: 'LISTA_PARA_REVISION' } }),
      this.prisma.encounter.findMany({
        where,
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          patient: { select: { id: true, nombre: true, rut: true } },
          createdBy: { select: { id: true, nombre: true } },
          sections: { select: { sectionKey: true, completed: true } },
        },
      }),
      this.prisma.encounterTask.findMany({
        where: {
          patient: {
            medicoId,
            archivedAt: null,
          },
          status: {
            in: ['PENDIENTE', 'EN_PROCESO'],
          },
        },
        take: 6,
        orderBy: [
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          patient: {
            select: { id: true, nombre: true, rut: true },
          },
          createdBy: {
            select: { id: true, nombre: true },
          },
        },
      }),
    ]);

    return {
      counts: {
        enProgreso,
        completado,
        cancelado,
        pendingReview,
        upcomingTasks: upcomingTasks.length,
        total: enProgreso + completado + cancelado,
      },
      recent: recent.map((enc) => ({
        id: enc.id,
        patientId: enc.patientId,
        patientName: enc.patient.nombre,
        patientRut: enc.patient.rut,
        createdByName: enc.createdBy.nombre,
        status: enc.status,
        createdAt: enc.createdAt,
        updatedAt: enc.updatedAt,
        progress: {
          completed: enc.sections.filter((s) => s.completed).length,
          total: enc.sections.length,
        },
      })),
      upcomingTasks: upcomingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        isOverdue: Boolean(task.dueDate && task.dueDate < today),
        patient: task.patient,
        createdBy: task.createdBy,
      })),
    };
  }

  private formatEncounter(encounter: any) {
    // Sort sections in order
    const sortedSections = [...(encounter.sections || [])].sort((a: any, b: any) => {
      return SECTION_ORDER.indexOf(a.sectionKey) - SECTION_ORDER.indexOf(b.sectionKey);
    });

    return {
      ...encounter,
      patient: encounter.patient
        ? {
            ...encounter.patient,
            history: encounter.patient.history,
            problems: (encounter.patient.problems || []).map((problem: any) => ({ ...problem })),
            tasks: (encounter.patient.tasks || []).map((task: any) => this.formatTask(task)),
          }
        : encounter.patient,
      tasks: (encounter.tasks || []).map((task: any) => this.formatTask(task)),
      sections: sortedSections.map((section: any) => ({
        ...section,
        data: parseSectionData(section.data) ?? {},
        label: SECTION_LABELS[section.sectionKey as SectionKey],
        order: SECTION_ORDER.indexOf(section.sectionKey as SectionKey),
      })),
    };
  }
}
