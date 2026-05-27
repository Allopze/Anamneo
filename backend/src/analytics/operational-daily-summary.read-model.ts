import { endOfAppDayUtcExclusive, extractDateOnlyIso, startOfAppDayUtc, todayLocalDateOnly } from '../common/utils/local-date';
import { getEffectiveMedicoId, type RequestUser } from '../common/utils/medico-id';
import type { PrismaService } from '../prisma/prisma.service';

export async function getOperationalDailySummaryReadModel(params: {
  prisma: PrismaService;
  user: RequestUser;
  date?: string;
}) {
  const { prisma, user } = params;
  const date = extractDateOnlyIso(params.date ?? todayLocalDateOnly());
  const start = startOfAppDayUtc(date);
  const end = endOfAppDayUtcExclusive(date);
  const medicoId = getEffectiveMedicoId(user);

  const [appointments, encounters] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        medicoId,
        startAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        status: true,
        cancelledAt: true,
        patientId: true,
      },
    }),
    prisma.encounter.findMany({
      where: {
        medicoId,
        createdAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        status: true,
        appointmentId: true,
        patientId: true,
      },
    }),
  ]);

  const scheduledAppointments = appointments.filter((item) => !item.cancelledAt);
  const appointmentStatusCounts = appointments.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const encounterStatusCounts = encounters.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const attendedFromAgenda = encounters.filter((item) => item.appointmentId).length;
  const walkIns = encounters.filter((item) => !item.appointmentId).length;
  const uniquePatients = new Set([
    ...appointments.map((item) => item.patientId).filter(Boolean),
    ...encounters.map((item) => item.patientId).filter(Boolean),
  ]).size;

  return {
    date,
    window: { start: start.toISOString(), endExclusive: end.toISOString() },
    summary: {
      appointmentsTotal: appointments.length,
      scheduledAppointments: scheduledAppointments.length,
      cancelledAppointments: appointments.filter((item) => item.cancelledAt || item.status === 'CANCELADA').length,
      noShowAppointments: appointments.filter((item) => item.status === 'NO_SHOW').length,
      attendedAppointments: appointments.filter((item) => item.status === 'ATENDIDA').length,
      encountersTotal: encounters.length,
      attendedFromAgenda,
      walkIns,
      uniquePatients,
      agendaConversionRate: scheduledAppointments.length > 0 ? attendedFromAgenda / scheduledAppointments.length : null,
    },
    appointmentStatusCounts,
    encounterStatusCounts,
  };
}
