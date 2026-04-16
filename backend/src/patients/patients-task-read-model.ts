import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/utils/medico-id';
import { buildEncounterTaskScopeWhere } from '../common/utils/patient-access';
import { isDateOnlyBeforeToday, startOfUtcDay } from '../common/utils/local-date';
import { PrismaService } from '../prisma/prisma.service';
import { formatTask } from './patients-format';

export interface PatientTaskInboxFilters {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
  overdueOnly?: boolean;
}

interface FindPatientTasksReadModelParams {
  prisma: PrismaService;
  user: RequestUser;
  effectiveMedicoId: string;
  filters?: PatientTaskInboxFilters;
}

export async function findPatientTasksReadModel(params: FindPatientTasksReadModelParams) {
  const { prisma, user, effectiveMedicoId, filters } = params;

  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;

  const whereClauses: Prisma.EncounterTaskWhereInput[] = [
    {
      patient: {
        archivedAt: null,
      },
    },
  ];

  if (!user.isAdmin) {
    whereClauses.push(buildEncounterTaskScopeWhere(effectiveMedicoId));
  }

  if (filters?.status) {
    whereClauses.push({ status: filters.status });
  }

  if (filters?.type) {
    whereClauses.push({ type: filters.type });
  }

  if (filters?.search?.trim()) {
    const search = filters.search.trim();
    whereClauses.push({
      OR: [
        { title: { contains: search } },
        { details: { contains: search } },
        { patient: { nombre: { contains: search } } },
      ],
    });
  }

  if (filters?.overdueOnly) {
    whereClauses.push({ dueDate: { lt: startOfUtcDay(new Date()) } });

    if (filters?.status) {
      if (!['PENDIENTE', 'EN_PROCESO'].includes(filters.status)) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
    } else {
      whereClauses.push({ status: { in: ['PENDIENTE', 'EN_PROCESO'] } });
    }
  }

  const where: Prisma.EncounterTaskWhereInput = whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

  const [tasks, total] = await Promise.all([
    prisma.encounterTask.findMany({
      where,
      skip,
      take: limit,
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
    prisma.encounterTask.count({ where }),
  ]);

  return {
    data: tasks.map((task) => ({
      ...formatTask(task),
      isOverdue: Boolean(
        task.dueDate && isDateOnlyBeforeToday(task.dueDate) && ['PENDIENTE', 'EN_PROCESO'].includes(task.status),
      ),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}