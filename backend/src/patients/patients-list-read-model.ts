import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/utils/medico-id';
import { buildAccessiblePatientsWhere, PatientArchiveFilter } from '../common/utils/patient-access';
import { startOfAppDayUtc } from '../common/utils/local-date';
import { PatientCompletenessStatus } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  decoratePatient,
} from './patients-format';
import { patientMatchesIdentifierSearch } from './patients-identifiers';

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
  const trimmedSearch = search?.trim();
  const normalizedClinicalSearch = filters?.clinicalSearch?.trim().toLowerCase();

  const baseWhere: Prisma.PatientWhereInput = {
    ...buildAccessiblePatientsWhere(user, filters?.archived ?? 'ACTIVE'),
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

  const orderBy = filters?.sortBy && filters.sortBy !== 'nombre'
    ? { [filters.sortBy]: filters.sortOrder || 'asc' }
    : { createdAt: 'desc' as const };

  async function readFilteredPatients(whereInput: Prisma.PatientWhereInput) {
    const candidates = await prisma.patient.findMany({
      where: whereInput,
      orderBy,
      include: {
        _count: {
          select: { encounters: true },
        },
      },
    });
    const filtered = trimmedSearch
      ? candidates.filter((patient) => patientMatchesIdentifierSearch(patient, trimmedSearch))
      : candidates;
    const decorated = filtered.map((patient) => decoratePatient(patient));
    if (filters?.sortBy === 'nombre') {
      decorated.sort((left, right) => {
        const direction = filters.sortOrder === 'desc' ? -1 : 1;
        return direction * left.nombre.localeCompare(right.nombre, 'es');
      });
    }
    return decorated;
  }

  function summarizePatients(patients: Array<{ completenessStatus: string }>) {
    const incomplete = patients.filter((patient) => patient.completenessStatus === 'INCOMPLETA').length;
    const pendingVerification = patients.filter((patient) => patient.completenessStatus === 'PENDIENTE_VERIFICACION').length;
    const verified = patients.filter((patient) => patient.completenessStatus === 'VERIFICADA').length;
    return {
      totalPatients: incomplete + pendingVerification + verified,
      incomplete,
      pendingVerification,
      verified,
      nonVerified: incomplete + pendingVerification,
    };
  }

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

    const patients = await readFilteredPatients(clinicalWhere);
    const pageData = patients.slice(skip, skip + limit);
    const summary = summarizePatients(patients);

    return {
      data: pageData,
      summary,
      pagination: {
        page,
        limit,
        total: patients.length,
        totalPages: Math.ceil(patients.length / limit),
      },
    };
  }

  if (trimmedSearch || filters?.sortBy === 'nombre') {
    const patients = await readFilteredPatients(where);
    const pageData = patients.slice(skip, skip + limit);
    const summary = summarizePatients(patients);

    return {
      data: pageData,
      summary,
      pagination: {
        page,
        limit,
        total: patients.length,
        totalPages: Math.ceil(patients.length / limit),
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
