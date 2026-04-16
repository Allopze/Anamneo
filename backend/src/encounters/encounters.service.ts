import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_REASON_LABELS } from '../audit/audit-catalog';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionKey, EncounterStatus } from '../common/types';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import {
  buildAccessiblePatientsWhere,
  buildEncounterTaskScopeWhere,
  buildPatientProblemScopeWhere,
  isPatientOwnedByMedico,
} from '../common/utils/patient-access';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { todayLocalDateOnly } from '../common/utils/local-date';
import {
  ENCOUNTER_SECTION_LABELS as SECTION_LABELS,
  ENCOUNTER_SECTION_ORDER as SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../common/utils/encounter-section-meta';
import {
  assertEncounterClinicalOutputAllowed,
} from '../common/utils/patient-completeness';
import { decryptField } from '../common/utils/field-crypto';
import { AlertsService } from '../alerts/alerts.service';
import {
  REQUIRED_COMPLETION_SECTIONS,
  REQUIRED_SEMANTIC_SECTIONS,
  VITAL_SIGNS_ALERT_GENERATION_WARNING,
  REVIEW_NOTE_MIN_LENGTH,
  IDENTIFICATION_SNAPSHOT_FIELD_META,
  serializeSectionData,
  parseSectionData,
  hasMeaningfulContent,
  sanitizeText,
  sanitizeRequiredWorkflowNote,
  sanitizeSectionPayload,
  summarizeSectionAuditData,
  summarizeWorkflowNoteAudit,
  buildIdentificationSnapshotFromPatient,
  buildAnamnesisRemotaSnapshotFromHistory,
  matchesCurrentPatientSnapshot,
} from './encounters-sanitize';
import {
  formatDashboardRecentEncounter,
  formatDashboardUpcomingTask,
  formatEncounterForList,
  formatEncounterForPatientList,
  formatEncounterResponse,
} from './encounters-presenters';

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
    let result: (ReturnType<EncountersService['formatEncounter']> & { reused: boolean }) | undefined;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) => {
            const effectiveMedicoId = getEffectiveMedicoId(user);
            const patient = await tx.patient.findUnique({
              where: { id: patientId },
              include: {
                history: true,
                createdBy: {
                  select: { medicoId: true },
                },
              },
            });

            if (!patient) {
              throw new NotFoundException('Paciente no encontrado');
            }

            if (patient.archivedAt) {
              throw new BadRequestException('No se puede crear una atención para un paciente archivado');
            }

            if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
              const hasEncounterAccess = await tx.encounter.findFirst({
                where: {
                  patientId,
                  medicoId: effectiveMedicoId,
                },
                select: { id: true },
              });

              if (!hasEncounterAccess) {
                throw new NotFoundException('Paciente no encontrado');
              }
            }

            const inProgress = await tx.encounter.findMany({
              where: {
                patientId,
                medicoId: effectiveMedicoId,
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

            const encounter = await tx.encounter.create({
              data: {
                patientId,
                medicoId: effectiveMedicoId,
                createdById: user.id,
                status: 'EN_PROGRESO',
                sections: {
                  create: SECTION_ORDER.map((key) => {
                    const sectionData =
                      key === 'IDENTIFICACION'
                        ? {
                            nombre: patient.nombre,
                            edad: patient.edad,
                            edadMeses: patient.edadMeses ?? undefined,
                            sexo: patient.sexo,
                            trabajo: patient.trabajo || '',
                            prevision: patient.prevision,
                            domicilio: patient.domicilio || '',
                            rut: patient.rut || '',
                            rutExempt: patient.rutExempt,
                            rutExemptReason: patient.rutExemptReason || '',
                          }
                        : key === 'ANAMNESIS_REMOTA' && patient.history
                          ? buildAnamnesisRemotaSnapshotFromHistory(patient.history)
                          : {};
                    return {
                      sectionKey: key,
                      data: serializeSectionData(sectionData),
                      schemaVersion: getEncounterSectionSchemaVersion(key),
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
    const skip = (page - 1) * limit;

    const where: any = {
      medicoId: effectiveMedicoId,
      patient: {
        archivedAt: null,
      },
    };

    if (status && ['EN_PROGRESO', 'COMPLETADO', 'FIRMADO', 'CANCELADO'].includes(status)) {
      where.status = status;
    }

    if (reviewStatus && ['NO_REQUIERE_REVISION', 'LISTA_PARA_REVISION', 'REVISADA_POR_MEDICO'].includes(reviewStatus)) {
      where.reviewStatus = reviewStatus;
    }

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      where.OR = [
        { patient: { nombre: { contains: trimmedSearch } } },
        { patient: { rut: { contains: trimmedSearch } } },
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
          reviewRequestedBy: {
            select: { id: true, nombre: true },
          },
          reviewedBy: {
            select: { id: true, nombre: true },
          },
          completedBy: {
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
      data: encounters.map((enc) => formatEncounterForList(enc)),
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
        medicoId: effectiveMedicoId,
      },
      include: {
        sections: {
          orderBy: { sectionKey: 'asc' },
        },
        patient: {
          include: {
            history: true,
            problems: {
              where: buildPatientProblemScopeWhere(effectiveMedicoId),
              orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
            },
            tasks: {
              where: buildEncounterTaskScopeWhere(effectiveMedicoId),
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
        reviewRequestedBy: {
          select: { id: true, nombre: true },
        },
        reviewedBy: {
          select: { id: true, nombre: true },
        },
        completedBy: {
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
        medicoId: effectiveMedicoId,
        patient: {
          archivedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
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
        sections: {
          select: { sectionKey: true, completed: true },
        },
      },
    });

    return encounters.map((enc) => formatEncounterForPatientList(enc));
  }

  // ─── Section update ──────────────────────────────────────────────────────

  async reconcileIdentificationSnapshot(encounterId: string, user: RequestUser) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { sections: true, patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.medicoId !== getEffectiveMedicoId(user)) {
      throw new ForbiddenException('No tiene permisos para editar esta atención');
    }

    if (encounter.status !== 'EN_PROGRESO') {
      throw new BadRequestException('Solo se puede reconciliar la identificación de atenciones en progreso');
    }

    const section = encounter.sections.find((s) => s.sectionKey === 'IDENTIFICACION');
    if (!section) {
      throw new NotFoundException('Sección de identificación no encontrada');
    }

    const snapshotData = buildIdentificationSnapshotFromPatient(encounter.patient);

    const updatedSection = await this.prisma.encounterSection.update({
      where: { id: section.id },
      data: {
        data: serializeSectionData(snapshotData),
        schemaVersion: getEncounterSectionSchemaVersion('IDENTIFICACION'),
      },
    });

    await this.auditService.log({
      entityType: 'EncounterSection',
      entityId: section.id,
      userId: user.id,
      action: 'UPDATE',
      reason: 'ENCOUNTER_SECTION_UPDATED',
      diff: { reconciledFields: IDENTIFICATION_SNAPSHOT_FIELD_META.map(({ key }) => key) },
    });

    const formattedSection = formatEncounterSectionForRead(updatedSection);

    return {
      id: updatedSection.id,
      encounterId: updatedSection.encounterId,
      sectionKey: updatedSection.sectionKey,
      completed: updatedSection.completed,
      notApplicable: updatedSection.notApplicable,
      updatedAt: updatedSection.updatedAt,
      data: formattedSection.data ?? {},
      schemaVersion: formattedSection.schemaVersion,
    };
  }

  async updateSection(encounterId: string, sectionKey: SectionKey, dto: UpdateSectionDto, user: RequestUser) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { sections: true, patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    const effectiveMedicoId = getEffectiveMedicoId(user);

    if (encounter.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para editar esta atención');
    }

    if (encounter.status === 'FIRMADO') {
      throw new BadRequestException('No se puede editar una atención firmada. Los registros firmados son inmutables');
    }

    if (encounter.status === 'COMPLETADO') {
      throw new BadRequestException('No se puede editar una atención completada');
    }

    if (encounter.status === 'CANCELADO') {
      throw new BadRequestException('No se puede editar una atención cancelada');
    }

    if (encounter.createdById !== user.id && user.role !== 'MEDICO') {
      throw new ForbiddenException('No tiene permisos para editar esta atención');
    }

    const section = encounter.sections.find((s) => s.sectionKey === sectionKey);
    if (!section) {
      throw new NotFoundException('Sección no encontrada');
    }

    const sanitizedData = sanitizeSectionPayload(sectionKey, dto.data);

    if (sectionKey === 'IDENTIFICACION' && !matchesCurrentPatientSnapshot(encounter, sanitizedData)) {
      throw new BadRequestException(
        'La identificación de la atención es un snapshot de solo lectura. Edite la ficha del paciente o restaure desde la ficha maestra.',
      );
    }

    if (
      dto.notApplicable &&
      (sectionKey === 'IDENTIFICACION' || REQUIRED_SEMANTIC_SECTIONS.includes(sectionKey))
    ) {
      throw new BadRequestException(
        'Esta sección es obligatoria y no se puede marcar como "No aplica"',
      );
    }

    if (dto.notApplicable && !dto.notApplicableReason) {
      throw new BadRequestException(
        'Debe indicar un motivo al marcar la sección como "No aplica"',
      );
    }

    const updatedSection = await this.prisma.encounterSection.update({
      where: { id: section.id },
      data: {
        data: serializeSectionData(sanitizedData),
        schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
        completed: dto.completed ?? section.completed,
        notApplicable: dto.notApplicable ?? section.notApplicable,
        notApplicableReason: dto.notApplicable ? (dto.notApplicableReason ?? section.notApplicableReason) : null,
      },
    });

    await this.auditService.log({
      entityType: 'EncounterSection',
      entityId: section.id,
      userId: user.id,
      action: 'UPDATE',
      diff: summarizeSectionAuditData(sectionKey, sanitizedData, dto.completed),
    });

    const vitalSigns =
      sectionKey === 'EXAMEN_FISICO'
        ? (sanitizedData as { signosVitales?: Record<string, string> }).signosVitales
        : undefined;

    let warnings: string[] | undefined;

    if (vitalSigns) {
      try {
        await this.alertsService.checkVitalSigns(encounter.patientId, encounterId, vitalSigns, user.id);
      } catch (error) {
        this.logger.error(
          `No se pudieron generar alertas automáticas de signos vitales para la atención ${encounterId}`,
          error instanceof Error ? error.stack : undefined,
        );
        warnings = [VITAL_SIGNS_ALERT_GENERATION_WARNING];
      }
    }

    const formattedSection = formatEncounterSectionForRead(updatedSection);

    return {
      id: updatedSection.id,
      encounterId: updatedSection.encounterId,
      sectionKey: updatedSection.sectionKey,
      completed: updatedSection.completed,
      notApplicable: updatedSection.notApplicable,
      notApplicableReason: updatedSection.notApplicableReason ?? null,
      updatedAt: updatedSection.updatedAt,
      data: formattedSection.data ?? {},
      schemaVersion: formattedSection.schemaVersion,
      ...(warnings ? { warnings } : {}),
    };
  }

  // ─── Workflow transitions ────────────────────────────────────────────────

  async complete(id: string, userId: string, closureNote?: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: { sections: true, patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.status !== 'EN_PROGRESO') {
      throw new BadRequestException('Solo se pueden completar atenciones en progreso');
    }

    if (encounter.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para completar esta atención');
    }

    assertEncounterClinicalOutputAllowed(encounter.patient, 'COMPLETE_ENCOUNTER');

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

    const sanitizedClosureNote = sanitizeRequiredWorkflowNote(closureNote, 'La nota de cierre', REVIEW_NOTE_MIN_LENGTH, 1000);

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'COMPLETADO',
        reviewStatus: 'REVISADA_POR_MEDICO',
        reviewedAt: new Date(),
        reviewedById: userId,
        completedAt: new Date(),
        completedById: userId,
        closureNote: sanitizedClosureNote,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: {
        status: 'COMPLETADO',
        closureNote: summarizeWorkflowNoteAudit(sanitizedClosureNote),
      },
    });

    return this.formatEncounter(updated);
  }

  async sign(id: string, userId: string, password: string, context: { ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      throw new ForbiddenException('Usuario no encontrado o inactivo');
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestException('Contraseña incorrecta. La firma requiere autenticación');
    }

    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: { sections: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.medicoId !== userId) {
      throw new ForbiddenException('Solo el médico tratante puede firmar esta atención');
    }

    if (encounter.status !== 'COMPLETADO') {
      throw new BadRequestException('Solo se pueden firmar atenciones completadas');
    }

    const contentPayload = encounter.sections
      .sort((a, b) => a.sectionKey.localeCompare(b.sectionKey))
      .map((s) => {
        const plain = typeof s.data === 'string' && s.data.startsWith('enc:') ? decryptField(s.data) : s.data;
        return { key: s.sectionKey, data: plain };
      });
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(contentPayload)).digest('hex');

    const [signature] = await this.prisma.$transaction([
      this.prisma.encounterSignature.create({
        data: {
          encounterId: id,
          userId,
          contentHash,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
        },
      }),
      this.prisma.encounter.update({
        where: { id },
        data: { status: 'FIRMADO' },
      }),
    ]);

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: {
        status: 'FIRMADO',
        signatureId: signature.id,
        contentHash,
      },
    });

    return { signatureId: signature.id, contentHash, signedAt: signature.signedAt };
  }

  async reopen(id: string, userId: string, note: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.status !== 'COMPLETADO') {
      throw new BadRequestException('Solo se pueden reabrir atenciones completadas (las firmadas son inmutables)');
    }

    if (encounter.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para reabrir esta atención');
    }

    const sanitizedNote = sanitizeRequiredWorkflowNote(
      note,
      'La nota de reapertura',
      REVIEW_NOTE_MIN_LENGTH,
      1000,
    );

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'EN_PROGRESO',
        reviewStatus: 'NO_REQUIERE_REVISION',
        reviewRequestedAt: null,
        reviewRequestedById: null,
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
        completedAt: null,
        completedById: null,
        closureNote: null,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: {
        status: 'EN_PROGRESO',
        reopenedBy: userId,
        note: summarizeWorkflowNoteAudit(sanitizedNote),
      },
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

    if (encounter.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para cancelar esta atención');
    }

    if (encounter.status !== 'EN_PROGRESO') {
      throw new BadRequestException('Solo se pueden cancelar atenciones en progreso');
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

    if (encounter.medicoId !== getEffectiveMedicoId(user)) {
      throw new ForbiddenException('No tiene permisos para actualizar la revisión de esta atención');
    }

    if (encounter.status === 'CANCELADO') {
      throw new BadRequestException('No se puede revisar una atención cancelada');
    }

    if (encounter.status === 'FIRMADO') {
      throw new BadRequestException('No se puede revisar una atención firmada. Los registros firmados son inmutables');
    }

    if (reviewStatus === 'REVISADA_POR_MEDICO' && user.role !== 'MEDICO') {
      throw new ForbiddenException('Solo un médico puede marcar la atención como revisada');
    }

    if (reviewStatus === 'LISTA_PARA_REVISION' && user.role !== 'ASISTENTE') {
      throw new BadRequestException('Solo un asistente puede enviar una atención a revisión médica');
    }

    if (reviewStatus === 'NO_REQUIERE_REVISION' && user.role !== 'MEDICO') {
      throw new ForbiddenException('Solo un médico puede despejar una revisión pendiente');
    }

    const sanitizedNote = reviewStatus === 'REVISADA_POR_MEDICO'
      ? sanitizeRequiredWorkflowNote(note, 'La nota de revisión', REVIEW_NOTE_MIN_LENGTH, 500)
      : sanitizeText(note, 500) ?? null;

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        reviewStatus,
        reviewRequestedAt: reviewStatus === 'LISTA_PARA_REVISION' ? new Date() : null,
        reviewRequestedById: reviewStatus === 'LISTA_PARA_REVISION' ? user.id : null,
        reviewedAt: reviewStatus === 'REVISADA_POR_MEDICO' ? new Date() : null,
        reviewedById: reviewStatus === 'REVISADA_POR_MEDICO' ? user.id : null,
        reviewNote: sanitizedNote,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
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
        note: summarizeWorkflowNoteAudit(sanitizedNote),
      },
    });

    return this.formatEncounter(updated);
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard(user: RequestUser) {
    const medicoId = getEffectiveMedicoId(user);
    const patientWhere = buildAccessiblePatientsWhere(user);

    const where = medicoId
      ? {
          medicoId,
          patient: {
            archivedAt: null,
          },
        }
      : {};

    const [
      enProgreso,
      completado,
      cancelado,
      pendingReview,
      recent,
      upcomingTasks,
      patientIncomplete,
      patientPendingVerification,
      patientVerified,
      overdueTasks,
    ] = await Promise.all([
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
            archivedAt: null,
          },
          ...(medicoId ? buildEncounterTaskScopeWhere(medicoId) : {}),
          status: {
            in: ['PENDIENTE', 'EN_PROCESO'],
          },
        },
        take: 6,
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
      this.prisma.patient.count({ where: { ...patientWhere, completenessStatus: 'INCOMPLETA' } }),
      this.prisma.patient.count({ where: { ...patientWhere, completenessStatus: 'PENDIENTE_VERIFICACION' } }),
      this.prisma.patient.count({ where: { ...patientWhere, completenessStatus: 'VERIFICADA' } }),
      this.prisma.encounterTask.count({
        where: {
          patient: { archivedAt: null },
          ...(medicoId ? buildEncounterTaskScopeWhere(medicoId) : {}),
          status: { in: ['PENDIENTE', 'EN_PROCESO'] },
          dueDate: { lt: new Date(`${todayLocalDateOnly()}T00:00:00.000Z`) },
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
        patientIncomplete,
        patientPendingVerification,
        patientVerified,
        patientNonVerified: patientIncomplete + patientPendingVerification,
        overdueTasks,
        total: enProgreso + completado + cancelado,
      },
      recent: recent.map((enc) => formatDashboardRecentEncounter(enc)),
      upcomingTasks: upcomingTasks.map((task) => formatDashboardUpcomingTask(task)),
    };
  }

  // ─── Response formatting ─────────────────────────────────────────────────

  private formatEncounter(encounter: any) {
    return formatEncounterResponse(encounter);
  }

  // ─── Audit history ───────────────────────────────────────────────────────

  async getAuditHistory(encounterId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, medicoId: effectiveMedicoId },
      select: {
        id: true,
        sections: { select: { id: true, sectionKey: true } },
      },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    const sectionIds = encounter.sections.map((s) => s.id);
    const sectionKeyMap = new Map(encounter.sections.map((s) => [s.id, s.sectionKey]));

    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'Encounter', entityId: encounterId },
          ...(sectionIds.length > 0 ? [{ entityType: 'EncounterSection', entityId: { in: sectionIds } }] : []),
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });

    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.nombre]));

    return logs.map((log) => {
      const sectionKey = log.entityType === 'EncounterSection' ? (sectionKeyMap.get(log.entityId) ?? null) : null;

      const reason = log.reason as string | null;
      const label =
        reason && reason in AUDIT_REASON_LABELS
          ? AUDIT_REASON_LABELS[reason as keyof typeof AUDIT_REASON_LABELS]
          : (reason ?? log.action);

      return {
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        reason,
        label,
        userName: userMap.get(log.userId) ?? 'Sistema',
        sectionKey,
        sectionLabel: sectionKey ? (SECTION_LABELS[sectionKey as SectionKey] ?? sectionKey) : null,
      };
    });
  }
}
