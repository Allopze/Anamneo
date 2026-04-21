import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';

describe('clinical-analytics.read-model', () => {
  it('scopes alerts to the effective medico, hides ambiguous regimen subtitles and computes age from birth date', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'enc-1',
            patientId: 'pat-1',
            createdAt: new Date('2026-04-14T12:00:00.000Z'),
            patient: {
              id: 'pat-1',
              fechaNacimiento: new Date('2000-04-15T12:00:00.000Z'),
              edad: 26,
              sexo: 'F',
              prevision: 'FONASA',
            },
            sections: [
              {
                sectionKey: 'TRATAMIENTO',
                data: {
                  medicamentosEstructurados: [
                    {
                      nombre: 'Omeprazol',
                      dosis: '20 mg',
                      via: 'ORAL',
                      frecuencia: 'cada 24 h',
                    },
                  ],
                },
              },
            ],
          },
          {
            id: 'enc-2',
            patientId: 'pat-2',
            createdAt: new Date('2026-04-16T12:00:00.000Z'),
            patient: {
              id: 'pat-2',
              fechaNacimiento: null,
              edad: 40,
              sexo: 'M',
              prevision: 'ISAPRE',
            },
            sections: [
              {
                sectionKey: 'TRATAMIENTO',
                data: {
                  medicamentosEstructurados: [
                    {
                      nombre: 'Omeprazol',
                      dosis: '40 mg',
                      via: 'ORAL',
                      frecuencia: 'cada 12 h',
                    },
                  ],
                },
              },
            ],
          },
        ]),
      },
      patientProblem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      clinicalAlert: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const result = await getClinicalAnalyticsSummaryReadModel({
      prisma: prisma as never,
      user: {
        id: 'med-1',
        email: 'medico@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: {
        source: 'ANY',
        fromDate: '2026-04-01',
        toDate: '2026-04-20',
        followUpDays: 30,
        limit: 10,
      },
    });

    expect(prisma.clinicalAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: { in: ['pat-1', 'pat-2'] },
          OR: [
            { encounterId: null },
            { encounter: { medicoId: 'med-1' } },
          ],
        }),
      }),
    );
    expect(result.summary.demographics.averageAge).toBe(32.5);
    expect(result.treatmentPatterns.medications).toEqual([
      expect.objectContaining({
        label: 'Omeprazol',
        encounterCount: 2,
        patientCount: 2,
        subtitle: undefined,
      }),
    ]);
    expect(result.treatmentOutcomeProxies.medications).toEqual([
      expect.objectContaining({
        label: 'Omeprazol',
        encounterCount: 2,
        patientCount: 2,
        subtitle: undefined,
      }),
    ]);
    expect(result.treatmentOutcomeProxies.exams).toEqual([]);
    expect(result.treatmentOutcomeProxies.referrals).toEqual([]);
  });
});