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
              processingObjections: null,
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
              processingObjections: null,
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
            {
              encounterId: null,
              OR: [
                { createdById: 'med-1' },
                { createdBy: { medicoId: 'med-1' } },
              ],
            },
            { encounter: { medicoId: 'med-1' } },
          ],
        }),
      }),
    );
    expect(result.summary.demographics.averageAge).toBe(32.5);
    expect(result.privacy).toEqual({
      smallCohortSuppressed: true,
      smallCohortThreshold: 10,
    });
    expect(result.caveats).toContain(
      'Cohorte pequeña (2 pacientes): se ocultaron desgloses detallados para reducir riesgo de reidentificación.',
    );
    expect(result.treatmentPatterns.medications).toEqual([]);
    expect(result.treatmentOutcomeProxies.medications).toEqual([]);
    expect(result.treatmentOutcomeProxies.exams).toEqual([]);
    expect(result.treatmentOutcomeProxies.referrals).toEqual([]);
  });

  it('counts follow-up by episode when the subsequent encounter no longer matches by raw condition text', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'enc-1',
            patientId: 'pat-1',
            createdAt: new Date('2026-04-10T12:00:00.000Z'),
            patient: {
              id: 'pat-1',
              fechaNacimiento: null,
              edad: 34,
              sexo: 'F',
              prevision: 'FONASA',
              processingObjections: null,
            },
            sections: [],
            diagnoses: [
              {
                source: 'AFECCION_PROBABLE',
                label: 'Gastritis',
                normalizedLabel: 'gastritis',
                code: null,
              },
            ],
            treatments: [],
            episode: {
              id: 'ep-1',
              label: 'Gastritis',
              normalizedLabel: 'gastritis',
              startDate: new Date('2026-04-10T12:00:00.000Z'),
              endDate: new Date('2026-04-15T12:00:00.000Z'),
              isActive: true,
            },
          },
          {
            id: 'enc-2',
            patientId: 'pat-1',
            createdAt: new Date('2026-04-15T12:00:00.000Z'),
            patient: {
              id: 'pat-1',
              fechaNacimiento: null,
              edad: 34,
              sexo: 'F',
              prevision: 'FONASA',
              processingObjections: null,
            },
            sections: [],
            diagnoses: [],
            treatments: [],
            episode: {
              id: 'ep-1',
              label: 'Gastritis',
              normalizedLabel: 'gastritis',
              startDate: new Date('2026-04-10T12:00:00.000Z'),
              endDate: new Date('2026-04-15T12:00:00.000Z'),
              isActive: true,
            },
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
        condition: 'gastritis',
        fromDate: '2026-04-01',
        toDate: '2026-04-20',
        followUpDays: 30,
        limit: 10,
      },
    });

    expect(result.summary.matchedEncounters).toBe(1);
    expect(result.summary.reconsultWithinWindowCount).toBe(1);
    expect(result.summary.reconsultWithinWindowRate).toBe(1);
  });

  it('excludes patients with active analytics objection from summary cohorts and follow-up lookups', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'enc-included',
            patientId: 'pat-included',
            createdAt: new Date('2026-04-10T12:00:00.000Z'),
            patient: {
              id: 'pat-included',
              fechaNacimiento: null,
              edad: 30,
              sexo: 'F',
              prevision: 'FONASA',
              processingObjections: null,
            },
            sections: [],
            diagnoses: [],
            treatments: [],
          },
          {
            id: 'enc-opt-out',
            patientId: 'pat-opt-out',
            createdAt: new Date('2026-04-11T12:00:00.000Z'),
            patient: {
              id: 'pat-opt-out',
              fechaNacimiento: null,
              edad: 45,
              sexo: 'M',
              prevision: 'ISAPRE',
              processingObjections: { ANALITICA_INTERNA: true },
            },
            sections: [],
            diagnoses: [],
            treatments: [],
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

    expect(result.summary.matchedPatients).toBe(1);
    expect(result.summary.matchedEncounters).toBe(1);
    expect(prisma.patientProblem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: { in: ['pat-included'] } }),
      }),
    );
    expect(prisma.clinicalAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: { in: ['pat-included'] } }),
      }),
    );
  });
});
