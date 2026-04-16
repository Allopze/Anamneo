import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/utils/medico-id';
import { buildEncounterTaskScopeWhere, buildPatientProblemScopeWhere } from '../common/utils/patient-access';
import { buildClinicalSummary, formatEncounterTimelineItem } from './patients-format';

interface EncounterTimelineParams {
  prisma: PrismaService;
  patientId: string;
  effectiveMedicoId: string;
  page: number;
  limit: number;
}

export async function getEncounterTimelineReadModel(params: EncounterTimelineParams) {
  const { prisma, patientId, effectiveMedicoId, page, limit } = params;
  const skip = (page - 1) * limit;
  const where = {
    patientId,
    medicoId: effectiveMedicoId,
  };

  const [encounters, total] = await Promise.all([
    prisma.encounter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        createdBy: {
          select: { id: true, nombre: true, email: true },
        },
        reviewRequestedBy: {
          select: { id: true, nombre: true },
        },
        reviewedBy: {
          select: { id: true, nombre: true },
        },
        completedBy: {
          select: { id: true, nombre: true },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            createdBy: {
              select: { id: true, nombre: true },
            },
          },
        },
        sections: {
          select: {
            id: true,
            encounterId: true,
            sectionKey: true,
            data: true,
            schemaVersion: true,
            completed: true,
            updatedAt: true,
          },
        },
      },
    }),
    prisma.encounter.count({ where }),
  ]);

  return {
    data: encounters.map((encounter) => formatEncounterTimelineItem(encounter)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

interface ClinicalSummaryParams {
  prisma: PrismaService;
  user: RequestUser;
  patientId: string;
  effectiveMedicoId: string;
  fullVitals: boolean;
}

export async function getClinicalSummaryReadModel(params: ClinicalSummaryParams) {
  const { prisma, user, patientId, effectiveMedicoId, fullVitals } = params;

  const [patient, encounters, activeProblemsCount, pendingTasksCount, totalEncounters] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: {
        id: true,
        problems: {
          where: {
            ...(user.isAdmin ? {} : buildPatientProblemScopeWhere(effectiveMedicoId)),
            status: {
              not: 'RESUELTO',
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            label: true,
            status: true,
            severity: true,
            updatedAt: true,
          },
        },
        tasks: {
          where: {
            ...(user.isAdmin ? {} : buildEncounterTaskScopeWhere(effectiveMedicoId)),
            status: {
              notIn: ['COMPLETADA', 'CANCELADA'],
            },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            dueDate: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.encounter.findMany({
      where: {
        patientId,
        medicoId: effectiveMedicoId,
      },
      orderBy: { createdAt: 'desc' },
      ...(fullVitals ? {} : { take: 12 }),
      select: {
        id: true,
        createdAt: true,
        sections: {
          select: {
            sectionKey: true,
            data: true,
            schemaVersion: true,
          },
        },
      },
    }),
    prisma.patientProblem.count({
      where: {
        patientId,
        ...(user.isAdmin ? {} : buildPatientProblemScopeWhere(effectiveMedicoId)),
        status: {
          not: 'RESUELTO',
        },
      },
    }),
    prisma.encounterTask.count({
      where: {
        patientId,
        ...(user.isAdmin ? {} : buildEncounterTaskScopeWhere(effectiveMedicoId)),
        status: {
          notIn: ['COMPLETADA', 'CANCELADA'],
        },
      },
    }),
    prisma.encounter.count({
      where: {
        patientId,
        medicoId: effectiveMedicoId,
      },
    }),
  ]);

  return buildClinicalSummary(
    encounters,
    patient,
    {
      totalEncounters,
      activeProblems: activeProblemsCount,
      pendingTasks: pendingTasksCount,
    },
    { fullVitals },
  );
}