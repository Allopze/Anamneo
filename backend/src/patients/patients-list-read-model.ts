import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/utils/medico-id';
import { buildAccessiblePatientsWhere, PatientArchiveFilter } from '../common/utils/patient-access';
import { startOfAppDayUtc } from '../common/utils/local-date';
import { PatientCompletenessStatus } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  decoratePatient,
} from './patients-format';

export interface FindPatientsFilters {
  archived?: PatientArchiveFilter;
  sexo?: string;
  prevision?: string;
  completenessStatus?: PatientCompletenessStatus;
  taskWindow?: 'OVERDUE' | 'TODAY' | 'THIS_WEEK' | 'NO_DUE_DATE';
  edadMin?: number;
  edadMax?: number;
  clinicalSearch?: string;
  sortBy?: 'nombre' | 'edad' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

const ACTIVE_TASK_STATUSES = ['PENDIENTE', 'EN_PROCESO'] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function buildTaskWindowFilter(taskWindow: FindPatientsFilters['taskWindow']): Prisma.EncounterTaskListRelationFilter | undefined {
  if (!taskWindow) {
    return undefined;
  }

  const todayStart = startOfAppDayUtc(new Date());
  const tomorrowStart = new Date(todayStart.getTime() + DAY_IN_MS);
  const weekWindowEnd = new Date(todayStart.getTime() + 8 * DAY_IN_MS);

  if (taskWindow === 'OVERDUE') {
    return {
      some: {
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueDate: { lt: todayStart },
      },
    };
  }

  if (taskWindow === 'TODAY') {
    return {
      some: {
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueDate: { gte: todayStart, lt: tomorrowStart },
      },
    };
  }

  if (taskWindow === 'THIS_WEEK') {
    return {
      some: {
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueDate: { gte: tomorrowStart, lt: weekWindowEnd },
      },
    };
  }

  return {
    some: {
      status: { in: [...ACTIVE_TASK_STATUSES] },
      dueDate: null,
    },
  };
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
    ...buildAccessiblePatientsWhere(user, filters?.archived ?? 'ACTIVE'),
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
  const taskWindowFilter = buildTaskWindowFilter(filters?.taskWindow);
  if (taskWindowFilter) baseWhere.tasks = taskWindowFilter;
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
    const clinicalSearchFilter: Prisma.PatientWhereInput = {
      clinicalSearches: {
        some: {
          text: { contains: normalizedClinicalSearch },
          ...(user.isAdmin ? {} : { medicoId: effectiveMedicoId }),
        },
      },
    };
    const clinicalWhere: Prisma.PatientWhereInput = {
      AND: [where, clinicalSearchFilter],
    };

    const [patients, total, incompleteCount, pendingVerificationCount, verifiedCount] = await Promise.all([
      prisma.patient.findMany({
        where: clinicalWhere,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { encounters: true },
          },
        },
      }),
      prisma.patient.count({ where: clinicalWhere }),
      prisma.patient.count({ where: { AND: [baseWhere, clinicalSearchFilter, { completenessStatus: 'INCOMPLETA' }] } }),
      prisma.patient.count({
        where: { AND: [baseWhere, clinicalSearchFilter, { completenessStatus: 'PENDIENTE_VERIFICACION' }] },
      }),
      prisma.patient.count({ where: { AND: [baseWhere, clinicalSearchFilter, { completenessStatus: 'VERIFICADA' }] } }),
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
