import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';
import {
  buildEncounterTaskScopeWhere,
  buildPatientProblemScopeWhere,
  isPatientOwnedByMedico,
} from '../common/utils/patient-access';
import { PrismaService } from '../prisma/prisma.service';
import {
  decoratePatient,
  formatAdminSummary,
  toCsvCell,
} from './patients-format';
import { findPatientsReadModel } from './patients-list-read-model';

export { findPatientsReadModel };
export type { FindPatientsFilters } from './patients-list-read-model';

interface ExportPatientsCsvParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
}

export async function exportPatientsCsvReadModel(params: ExportPatientsCsvParams) {
  const { prisma, auditService, user } = params;

  const patients = await prisma.patient.findMany({
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

  await auditService.log({
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

interface GetPatientAdminSummaryParams {
  prisma: PrismaService;
  id: string;
}

export async function getPatientAdminSummaryReadModel(params: GetPatientAdminSummaryParams) {
  const { prisma, id } = params;

  const patient = await prisma.patient.findUnique({
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

interface FindPatientByIdParams {
  prisma: PrismaService;
  user: RequestUser;
  id: string;
  effectiveMedicoId: string;
}

export async function findPatientByIdReadModel(params: FindPatientByIdParams) {
  const { prisma, user, id, effectiveMedicoId } = params;

  const patient = await prisma.patient.findUnique({
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

  if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
    const hasEncounter = await prisma.encounter.findFirst({
      where: { patientId: id, medicoId: effectiveMedicoId },
      select: { id: true },
    });
    if (!hasEncounter) {
      throw new NotFoundException('Paciente no encontrado');
    }
  }

  return decoratePatient(patient);
}