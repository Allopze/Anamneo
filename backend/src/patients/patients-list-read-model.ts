import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/utils/medico-id';
import { buildAccessiblePatientsWhere } from '../common/utils/patient-access';
import { PatientCompletenessStatus } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  decoratePatient,
  matchesClinicalSearch,
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
