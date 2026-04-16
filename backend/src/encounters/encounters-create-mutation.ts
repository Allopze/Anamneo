import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
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

export async function createEncounterMutation(params: CreateEncounterMutationParams) {
  const {
    prisma,
    auditService,
    patientId,
    createDto: _createDto,
    user,
  } = params;

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
              ...formatEncounterResponse(inProgress[0]),
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
            ...formatEncounterResponse(encounter),
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

  if (!result.reused) {
    await auditService.log({
      entityType: 'Encounter',
      entityId: result.id,
      userId: user.id,
      action: 'CREATE',
      diff: { patientId, status: 'EN_PROGRESO' },
    });
  }

  return result;
}
