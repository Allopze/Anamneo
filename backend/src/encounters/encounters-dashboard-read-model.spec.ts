import { getEncounterHeaderCountsReadModel } from './encounters-dashboard-read-model';

describe('getEncounterHeaderCountsReadModel', () => {
  it('builds header counts without loading dashboard lists', async () => {
    const encounterCount = jest.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    const taskCount = jest.fn()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    const patientCount = jest.fn()
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(20);
    const prisma = {
      encounter: {
        count: encounterCount,
        findMany: jest.fn(),
      },
      encounterTask: {
        count: taskCount,
        findMany: jest.fn(),
      },
      patient: {
        count: patientCount,
      },
    } as any;

    const result = await getEncounterHeaderCountsReadModel({
      prisma,
      medicoId: 'med-1',
      user: { id: 'med-1', role: 'MEDICO', isAdmin: false } as any,
    });

    expect(result.counts).toEqual(expect.objectContaining({
      enProgreso: 2,
      completado: 7,
      cancelado: 1,
      pendingReview: 3,
      upcomingTasks: 5,
      patientIncomplete: 6,
      patientPendingVerification: 4,
      patientVerified: 20,
      patientNonVerified: 10,
      overdueTasks: 1,
      total: 10,
    }));
    expect(prisma.encounter.findMany).not.toHaveBeenCalled();
    expect(prisma.encounterTask.findMany).not.toHaveBeenCalled();
  });
});
