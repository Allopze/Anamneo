import { getOperationalDailySummaryReadModel } from './operational-daily-summary.read-model';

describe('operational-daily-summary.read-model', () => {
  it('summarizes agenda conversion, walk-ins and no-shows for a day', async () => {
    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'appt-1', status: 'ATENDIDA', cancelledAt: null, patientId: 'pat-1' },
          { id: 'appt-2', status: 'NO_SHOW', cancelledAt: null, patientId: 'pat-2' },
          { id: 'appt-3', status: 'CANCELADA', cancelledAt: new Date(), patientId: 'pat-3' },
        ]),
      },
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'enc-1', status: 'EN_PROGRESO', appointmentId: 'appt-1', patientId: 'pat-1' },
          { id: 'enc-2', status: 'COMPLETADO', appointmentId: null, patientId: 'pat-4' },
        ]),
      },
    };

    const result = await getOperationalDailySummaryReadModel({
      prisma: prisma as never,
      user: { id: 'med-1', role: 'MEDICO', isAdmin: false } as never,
      date: '2026-05-27',
    });

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ medicoId: 'med-1' }),
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        appointmentsTotal: 3,
        scheduledAppointments: 2,
        cancelledAppointments: 1,
        noShowAppointments: 1,
        encountersTotal: 2,
        attendedFromAgenda: 1,
        walkIns: 1,
        uniquePatients: 4,
        agendaConversionRate: 0.5,
      }),
    );
  });
});
