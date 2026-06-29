import { reconcileEncounterEpisode, removeEncounterFromEpisode } from './encounters-episodes';

describe('encounters-episodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reassigns an encounter to a new episode and recomputes the old episode window', async () => {
    const encounterFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'enc-2',
        status: 'EN_PROGRESO',
        episodeId: 'ep-old',
        episode: { id: 'ep-old', normalizedLabel: 'gastritis' },
      })
      .mockResolvedValueOnce({
        id: 'enc-2',
        episodeId: 'ep-old',
      });

    const prisma = {
      encounter: {
        findUnique: encounterFindUnique,
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { id: 'enc-2', createdAt: new Date('2026-04-20T12:00:00.000Z') },
          ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      encounterEpisode: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'ep-new' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    await reconcileEncounterEpisode({
      prisma: prisma as never,
      encounterId: 'enc-2',
      patientId: 'pat-1',
      encounterCreatedAt: new Date('2026-04-20T12:00:00.000Z'),
      diagnoses: [
        { label: 'Cefalea tensional', normalizedLabel: 'cefalea tensional' },
      ],
    });

    expect(prisma.encounter.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'enc-2' },
      data: { episodeId: null },
    });
    expect(prisma.encounterEpisode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: 'pat-1',
        label: 'Cefalea tensional',
        normalizedLabel: 'cefalea tensional',
      }),
      select: { id: true },
    });
    expect(prisma.encounter.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'enc-2' },
      data: { episodeId: 'ep-new' },
    });
    expect(prisma.encounterEpisode.update).toHaveBeenCalledWith({
      where: { id: 'ep-old' },
      data: {
        firstEncounterId: null,
        lastEncounterId: null,
        startDate: null,
        endDate: null,
        isActive: false,
      },
    });
  });

  it('removes an encounter from its episode and recomputes the remaining window', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-3',
          episodeId: 'ep-1',
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'enc-1', createdAt: new Date('2026-04-01T10:00:00.000Z') },
          { id: 'enc-4', createdAt: new Date('2026-04-05T10:00:00.000Z') },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      encounterEpisode: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    await removeEncounterFromEpisode({
      prisma: prisma as never,
      encounterId: 'enc-3',
    });

    expect(prisma.encounter.update).toHaveBeenCalledWith({
      where: { id: 'enc-3' },
      data: { episodeId: null },
    });
    expect(prisma.encounterEpisode.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: {
        firstEncounterId: 'enc-1',
        lastEncounterId: 'enc-4',
        startDate: new Date('2026-04-01T10:00:00.000Z'),
        endDate: new Date('2026-04-05T10:00:00.000Z'),
        isActive: true,
      },
    });
  });
});