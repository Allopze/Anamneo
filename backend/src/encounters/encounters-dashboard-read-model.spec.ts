import { getEncounterDashboardReadModel, getEncounterHeaderCountsReadModel } from './encounters-dashboard-read-model';

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

describe('getEncounterDashboardReadModel', () => {
  it('loads active encounters separately from recent activity', async () => {
    const encounterCount = jest.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    const recentFindMany = [
      buildEncounter({ id: 'recent-1', status: 'COMPLETADO', updatedAt: new Date('2026-04-20T10:00:00.000Z') }),
    ];
    const activeFindMany = [
      buildEncounter({ id: 'active-2', status: 'EN_PROGRESO', updatedAt: new Date('2026-04-21T12:00:00.000Z') }),
      buildEncounter({ id: 'active-1', status: 'EN_PROGRESO', updatedAt: new Date('2026-04-21T11:00:00.000Z') }),
    ];
    const encounterFindMany = jest.fn()
      .mockResolvedValueOnce(recentFindMany)
      .mockResolvedValueOnce(activeFindMany);
    const taskCount = jest.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    const prisma = {
      encounter: {
        count: encounterCount,
        findMany: encounterFindMany,
      },
      encounterTask: {
        count: taskCount,
        findMany: jest.fn().mockResolvedValue([]),
      },
      patient: {
        count: jest.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3),
      },
    } as any;

    const result = await getEncounterDashboardReadModel({
      prisma,
      medicoId: 'med-1',
      user: { id: 'med-1', role: 'MEDICO', isAdmin: false } as any,
    });

    expect(encounterFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      take: 8,
      orderBy: { updatedAt: 'desc' },
      where: expect.objectContaining({ status: 'EN_PROGRESO' }),
    }));
    expect(result.activeEncounters).toEqual([
      expect.objectContaining({ id: 'active-2', status: 'EN_PROGRESO' }),
      expect.objectContaining({ id: 'active-1', status: 'EN_PROGRESO' }),
    ]);
    expect(result.recent).toEqual([
      expect.objectContaining({ id: 'recent-1', status: 'COMPLETADO' }),
    ]);
  });
});

function buildEncounter(overrides: { id: string; status: string; updatedAt: Date }) {
  return {
    id: overrides.id,
    patientId: `patient-${overrides.id}`,
    patient: {
      id: `patient-${overrides.id}`,
      nombre: `Paciente ${overrides.id}`,
      rut: '11.111.111-1',
    },
    createdBy: {
      id: 'med-1',
      nombre: 'Medico Demo',
    },
    status: overrides.status,
    createdAt: new Date('2026-04-20T09:00:00.000Z'),
    updatedAt: overrides.updatedAt,
    episode: null,
    sections: [
      { sectionKey: 'identificacion', completed: true },
      { sectionKey: 'motivoConsulta', completed: false },
    ],
  };
}
