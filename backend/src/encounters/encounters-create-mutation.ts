import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { SectionKey } from '../common/types';
import { isPatientOwnedByMedico } from '../common/utils/patient-access';
import {
  ENCOUNTER_SECTION_ORDER as SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../common/utils/encounter-section-meta';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import {
  buildAnamnesisRemotaSnapshotFromHistory,
  serializeSectionData,
} from './encounters-sanitize';
import { formatEncounterResponse } from './encounters-presenters';
import { withPatientIdentifiers } from '../patients/patients-identifiers';
import {
  getEnabledEncounterSectionKeys,
  type EncounterSectionConfig,
} from '../../../shared/encounter-section-config';

interface CreateEncounterMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  patientId: string;
  createDto: CreateEncounterDto;
  user: RequestUser;
  sectionConfig?: EncounterSectionConfig;
}

type FormattedEncounter = ReturnType<typeof formatEncounterResponse>;

const DUPLICATE_SOURCE_ALLOWED_STATUSES = new Set(['COMPLETADO', 'FIRMADO']);

function buildInitialEncounterSectionData(
  key: SectionKey,
  patient: {
    nombreEnc?: string | null;
    edad: number | null;
    edadMeses: number | null;
    sexo: string | null;
    trabajo: string | null;
    prevision: string | null;
    domicilioEnc?: string | null;
    rutEnc?: string | null;
    rutExempt: boolean;
    rutExemptReason: string | null;
    history?: Record<string, unknown> | null;
  },
) {
  if (key === 'IDENTIFICACION') {
    const identifiers = withPatientIdentifiers(patient);
    return {
      nombre: identifiers.nombre,
      edad: patient.edad,
      edadMeses: patient.edadMeses ?? undefined,
      sexo: patient.sexo,
      trabajo: patient.trabajo || '',
      prevision: patient.prevision,
      domicilio: identifiers.domicilio || '',
      rut: identifiers.rut || '',
      rutExempt: patient.rutExempt,
      rutExemptReason: patient.rutExemptReason || '',
    };
  }

  if (key === 'ANAMNESIS_REMOTA' && patient.history) {
    return buildAnamnesisRemotaSnapshotFromHistory(patient.history);
  }

  return {};
}

export async function createEncounterMutation(params: CreateEncounterMutationParams) {
  const {
    prisma,
    auditService,
    patientId,
    createDto,
    user,
    sectionConfig,
  } = params;
  const duplicateFromEncounterId = createDto.duplicateFromEncounterId?.trim();
  const appointmentId = createDto.appointmentId?.trim();
  const sectionKeys = sectionConfig
    ? getEnabledEncounterSectionKeys(sectionConfig) as SectionKey[]
    : SECTION_ORDER;

  let result: (FormattedEncounter & { reused: boolean }) | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await prisma.$transaction(
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

          const appointment = appointmentId
            ? await tx.appointment.findUnique({
                where: { id: appointmentId },
                select: {
                  id: true,
                  patientId: true,
                  medicoId: true,
                  cancelledAt: true,
                  encounter: { select: { id: true } },
                },
              })
            : null;

          if (appointmentId && !appointment) {
            throw new NotFoundException('Cita no encontrada');
          }

          if (appointment) {
            if (appointment.cancelledAt) {
              throw new BadRequestException('No se puede crear una atención desde una cita cancelada');
            }
            if (appointment.medicoId !== effectiveMedicoId || appointment.patientId !== patientId) {
              throw new NotFoundException('Cita no encontrada para este paciente');
            }
            if (appointment.encounter) {
              throw new ConflictException({ code: 'APPOINTMENT_ENCOUNTER_EXISTS', message: 'Esta cita ya tiene una atención asociada.' });
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
            if (appointment && !inProgress[0].appointmentId) {
              const linkedEncounter = await tx.encounter.update({
                where: { id: inProgress[0].id },
                data: { appointmentId: appointment.id },
                include: {
                  sections: { select: { completed: true } },
                  patient: true,
                  createdBy: { select: { id: true, nombre: true, email: true } },
                },
              });
              await tx.appointment.update({
                where: { id: appointment.id },
                data: { status: 'ATENDIDA' },
              });
              await auditService.log(
                {
                  entityType: 'Appointment',
                  entityId: appointment.id,
                  userId: user.id,
                  action: 'UPDATE',
                  reason: 'APPOINTMENT_UPDATED',
                  diff: { status: 'ATENDIDA', encounterId: linkedEncounter.id, reusedEncounter: true },
                },
                tx,
              );
              return {
                ...formatEncounterResponse(linkedEncounter, { viewerRole: user.role }),
                reused: true,
              };
            }
            return {
              ...formatEncounterResponse(inProgress[0], { viewerRole: user.role }),
              reused: true,
            };
          }

          if (inProgress.length > 1) {
            throw new ConflictException({
              code: 'ENCOUNTER_MULTIPLE_IN_PROGRESS',
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

          const duplicateSource = duplicateFromEncounterId
            ? await tx.encounter.findFirst({
                where: {
                  id: duplicateFromEncounterId,
                  patientId,
                  medicoId: effectiveMedicoId,
                },
                select: {
                  id: true,
                  status: true,
                },
              })
            : null;

          if (duplicateFromEncounterId && !duplicateSource) {
            throw new NotFoundException('La atención base para duplicar no existe o no corresponde al paciente');
          }

          if (duplicateSource && !DUPLICATE_SOURCE_ALLOWED_STATUSES.has(duplicateSource.status)) {
            throw new BadRequestException('Solo se pueden usar como base atenciones completadas o firmadas');
          }

          const encounter = await tx.encounter.create({
            data: {
              patientId,
              medicoId: effectiveMedicoId,
              createdById: user.id,
              appointmentId: appointment?.id ?? null,
              status: 'EN_PROGRESO',
              sections: {
                create: sectionKeys.map((key) => {
                  const sectionData = buildInitialEncounterSectionData(key, patient);

                  return {
                    sectionKey: key,
                    data: typeof sectionData === 'string' ? sectionData : serializeSectionData(sectionData),
                    schemaVersion: getEncounterSectionSchemaVersion(key),
                    completed: key === 'IDENTIFICACION',
                    notApplicable: false,
                    notApplicableReason: null,
                  };
                }),
              },
            },
            include: {
              sections: true,
              patient: true,
              episode: {
                select: {
                  id: true,
                  label: true,
                  normalizedLabel: true,
                  startDate: true,
                  endDate: true,
                  isActive: true,
                },
              },
              createdBy: {
                select: { id: true, nombre: true, email: true },
              },
            },
          });

          await auditService.log(
            {
              entityType: 'Encounter',
              entityId: encounter.id,
              userId: user.id,
              action: 'CREATE',
              diff: {
                patientId,
                status: 'EN_PROGRESO',
                duplicatedFromEncounterId: duplicateFromEncounterId ?? null,
                appointmentId: appointment?.id ?? null,
              },
            },
            tx,
          );

          if (appointment) {
            await tx.appointment.update({
              where: { id: appointment.id },
              data: { status: 'ATENDIDA' },
            });
            await auditService.log(
              {
                entityType: 'Appointment',
                entityId: appointment.id,
                userId: user.id,
                action: 'UPDATE',
                reason: 'APPOINTMENT_UPDATED',
                diff: { status: 'ATENDIDA', encounterId: encounter.id },
              },
              tx,
            );
          }

          return {
            ...formatEncounterResponse(encounter, { viewerRole: user.role }),
            reused: false,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 3
      ) {
        continue;
      }
      throw error;
    }
  }

  if (!result) {
    throw new ConflictException('No se pudo crear la atención. Intente nuevamente.');
  }

  return result;
}
