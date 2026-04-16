import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';
import {
  buildAccessiblePatientsWhere,
  buildEncounterTaskScopeWhere,
  buildPatientProblemScopeWhere,
  isPatientOwnedByMedico,
} from '../common/utils/patient-access';
import { PatientCompletenessStatus } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  decoratePatient,
  formatAdminSummary,
  matchesClinicalSearch,
  toCsvCell,
} from './patients-format';

export interface FindPatientsFilters {
  sexo?: string;
  prevision?: string;
  completenessStatus?: PatientCompletenessStatus;
  edadMin?: number;
  edadMax?: number;
  clinicalSearch?: string;
  sortBy?: 'nombre' | 'edad' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

interface FindPatientsReadModelParams {
  prisma: PrismaService;
  user: RequestUser;
  effectiveMedicoId: string;
  search?: string;
  page: number;
  limit: number;
  filters?: FindPatientsFilters;
}

export async function findPatientsReadModel(params: FindPatientsReadModelParams) {
  const {
    prisma,
    user,
    effectiveMedicoId,
    search,
    page,
    limit,
    filters,
  } = params;

  const skip = (page - 1) * limit;
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
    const patients = await prisma.patient.findMany({
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
    prisma.patient.findMany({
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
    prisma.patient.count({ where }),
    prisma.patient.count({ where: { ...baseWhere, completenessStatus: 'INCOMPLETA' } }),
    prisma.patient.count({ where: { ...baseWhere, completenessStatus: 'PENDIENTE_VERIFICACION' } }),
    prisma.patient.count({ where: { ...baseWhere, completenessStatus: 'VERIFICADA' } }),
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