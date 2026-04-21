import { buildAccessiblePatientsWhere, buildEncounterTaskScopeWhere } from '../common/utils/patient-access';
import { endOfAppDayUtcExclusive, startOfAppDayUtc } from '../common/utils/local-date';
import { RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import { formatDashboardRecentEncounter, formatDashboardUpcomingTask } from './encounters-presenters';

const ACTIVE_TASK_STATUSES = ['PENDIENTE', 'EN_PROCESO'] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface EncounterDashboardReadModelParams {
  prisma: PrismaService;
  user: RequestUser;
  medicoId: string;
}

export async function getEncounterDashboardReadModel(params: EncounterDashboardReadModelParams) {
  const { prisma, user, medicoId } = params;
  const patientWhere = buildAccessiblePatientsWhere(user);
  const todayStart = startOfAppDayUtc(new Date());
  const tomorrowStart = endOfAppDayUtcExclusive(new Date());
  const weekWindowEnd = new Date(todayStart.getTime() + 8 * DAY_IN_MS);
  const where = {
    medicoId,
    patient: {
      archivedAt: null,
    },
  };

  const [
    enProgreso,
    completado,
    cancelado,
    pendingReview,
    recent,
    upcomingTasks,
    patientIncomplete,
    patientPendingVerification,
    patientVerified,
    overdueTasks,
    dueTodayTasks,
    dueThisWeekTasks,
    upcomingAdministrativeTasks,
  ] = await Promise.all([
    prisma.encounter.count({ where: { ...where, status: 'EN_PROGRESO' } }),
    prisma.encounter.count({ where: { ...where, status: 'COMPLETADO' } }),
    prisma.encounter.count({ where: { ...where, status: 'CANCELADO' } }),
    prisma.encounter.count({ where: { ...where, reviewStatus: 'LISTA_PARA_REVISION' } }),
    prisma.encounter.findMany({
      where,
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: {
        patient: { select: { id: true, nombre: true, rut: true } },
        createdBy: { select: { id: true, nombre: true } },
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
        sections: { select: { sectionKey: true, completed: true } },
      },
    }),
    prisma.encounterTask.findMany({
      where: {
        patient: {
          archivedAt: null,
        },
        ...buildEncounterTaskScopeWhere(medicoId),
        status: {
          in: [...ACTIVE_TASK_STATUSES],
        },
      },
      take: 6,
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
    prisma.patient.count({ where: { ...patientWhere, completenessStatus: 'INCOMPLETA' } }),
    prisma.patient.count({ where: { ...patientWhere, completenessStatus: 'PENDIENTE_VERIFICACION' } }),
    prisma.patient.count({ where: { ...patientWhere, completenessStatus: 'VERIFICADA' } }),
    prisma.encounterTask.count({
      where: {
        patient: { archivedAt: null },
        ...buildEncounterTaskScopeWhere(medicoId),
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueDate: { lt: todayStart },
      },
    }),
    prisma.encounterTask.count({
      where: {
        patient: { archivedAt: null },
        ...buildEncounterTaskScopeWhere(medicoId),
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueDate: { gte: todayStart, lt: tomorrowStart },
      },
    }),
    prisma.encounterTask.count({
      where: {
        patient: { archivedAt: null },
        ...buildEncounterTaskScopeWhere(medicoId),
        status: { in: [...ACTIVE_TASK_STATUSES] },
        dueDate: { gte: tomorrowStart, lt: weekWindowEnd },
      },
    }),
    prisma.encounterTask.count({
      where: {
        patient: { archivedAt: null },
        ...buildEncounterTaskScopeWhere(medicoId),
        status: { in: [...ACTIVE_TASK_STATUSES] },
        type: 'TRAMITE',
        dueDate: { gte: todayStart, lt: weekWindowEnd },
      },
    }),
  ]);

  return {
    counts: {
      enProgreso,
      completado,
      cancelado,
      pendingReview,
      upcomingTasks: upcomingTasks.length,
      patientIncomplete,
      patientPendingVerification,
      patientVerified,
      patientNonVerified: patientIncomplete + patientPendingVerification,
      overdueTasks,
      dueTodayTasks,
      dueThisWeekTasks,
      upcomingAdministrativeTasks,
      total: enProgreso + completado + cancelado,
    },
    recent: recent.map((encounter) => formatDashboardRecentEncounter(encounter)),
    upcomingTasks: upcomingTasks.map((task) => formatDashboardUpcomingTask(task)),
  };
}