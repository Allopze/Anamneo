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

interface CreateEncounterMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  patientId: string;
  createDto: CreateEncounterDto;
  user: RequestUser;
}

type FormattedEncounter = ReturnType<typeof formatEncounterResponse>;

const DUPLICATE_SOURCE_ALLOWED_STATUSES = new Set(['COMPLETADO', 'FIRMADO']);

function buildInitialEncounterSectionData(
  key: SectionKey,
  patient: {
    nombre: string;
    edad: number | null;
    edadMeses: number | null;
    sexo: string | null;
    trabajo: string | null;
    prevision: string | null;
    domicilio: string | null;
    rut: string | null;
    rutExempt: boolean;
    rutExemptReason: string | null;
    history?: Record<string, unknown> | null;
  },
) {
  if (key === 'IDENTIFICACION') {
    return {
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
  } = params;
  const duplicateFromEncounterId = createDto.duplicateFromEncounterId?.trim();

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
              ...formatEncounterResponse(inProgress[0], { viewerRole: user.role }),
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
              status: 'EN_PROGRESO',
              sections: {
                create: SECTION_ORDER.map((key) => {
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
              },
            },
            tx,
          );

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
