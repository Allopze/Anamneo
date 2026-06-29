import { getClinicalAnalyticsCasesReadModel } from './clinical-analytics.cases.read-model';

describe('clinical-analytics.cases.read-model', () => {
  it('excludes patients with analytics objection from case-level exports', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'enc-included',
            patientId: 'pat-included',
            createdAt: new Date('2026-04-10T12:00:00.000Z'),
            status: 'COMPLETADO',
            patient: {
              id: 'pat-included',
              nombreEnc: null,
              rutEnc: null,
              edad: 30,
              sexo: 'F',
              prevision: 'FONASA',
              processingObjections: null,
            },
            sections: [],
            diagnoses: [],
            treatments: [],
            episode: null,
          },
          {
            id: 'enc-opt-out',
            patientId: 'pat-opt-out',
            createdAt: new Date('2026-04-11T12:00:00.000Z'),
            status: 'COMPLETADO',
            patient: {
              id: 'pat-opt-out',
              nombreEnc: null,
              rutEnc: null,
              edad: 45,
              sexo: 'M',
              prevision: 'ISAPRE',
              processingObjections: { ANALITICA_INTERNA: true },
            },
            sections: [],
            diagnoses: [],
            treatments: [],
            episode: null,
          },
        ]),
      },
    };

    const result = await getClinicalAnalyticsCasesReadModel({
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
        page: 1,
        pageSize: 15,
      },
    });

    expect(result.pagination.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].encounterId).toBe('enc-included');
  });
});
