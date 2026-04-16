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
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { SectionKey, EncounterStatus } from '../common/types';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import {
  isPatientOwnedByMedico,
} from '../common/utils/patient-access';
import {
  ENCOUNTER_SECTION_ORDER as SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../common/utils/encounter-section-meta';
import {
  assertEncounterClinicalOutputAllowed,
} from '../common/utils/patient-completeness';
import { AlertsService } from '../alerts/alerts.service';
import {
  serializeSectionData,
  buildIdentificationSnapshotFromPatient,
  buildAnamnesisRemotaSnapshotFromHistory,
} from './encounters-sanitize';
import {
  formatEncounterResponse,
} from './encounters-presenters';
import {
  findEncounterByIdReadModel,
  findEncountersByPatientReadModel,
  findEncountersReadModel,
} from './encounters-read-side';
import { getEncounterDashboardReadModel } from './encounters-dashboard-read-model';
import { getEncounterAuditHistoryReadModel } from './encounters-audit-history';
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

  // ─── Response formatting ─────────────────────────────────────────────────

  private formatEncounter(encounter: any) {
    return formatEncounterResponse(encounter);
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
