import { buildAccessiblePatientsWhere, buildEncounterTaskScopeWhere } from '../common/utils/patient-access';
import { todayLocalDateOnly } from '../common/utils/local-date';
import { RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import { formatDashboardRecentEncounter, formatDashboardUpcomingTask } from './encounters-presenters';

interface EncounterDashboardReadModelParams {
  prisma: PrismaService;
  user: RequestUser;
  medicoId: string;
}

export async function getEncounterDashboardReadModel(params: EncounterDashboardReadModelParams) {
  const { prisma, user, medicoId } = params;
  const patientWhere = buildAccessiblePatientsWhere(user);
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
          in: ['PENDIENTE', 'EN_PROCESO'],
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
        status: { in: ['PENDIENTE', 'EN_PROCESO'] },
        dueDate: { lt: new Date(`${todayLocalDateOnly()}T00:00:00.000Z`) },
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
      total: enProgreso + completado + cancelado,
    },
    recent: recent.map((encounter) => formatDashboardRecentEncounter(encounter)),
    upcomingTasks: upcomingTasks.map((task) => formatDashboardUpcomingTask(task)),
  };
}