import { exportClinicalAnalyticsSummaryCsvReadModel } from './clinical-analytics.summary.export';

jest.mock('./clinical-analytics.read-model', () => ({
  getClinicalAnalyticsSummaryReadModel: jest.fn(),
}));

import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';

describe('clinical-analytics.summary.export', () => {
  it('exports the clinical analytics summary to a CSV and audits the download', async () => {
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    (getClinicalAnalyticsSummaryReadModel as jest.Mock).mockResolvedValue({
      filters: {
        condition: 'dolor abdominal',
        source: 'ANY',
        fromDate: '2026-04-01',
        toDate: '2026-04-20',
        followUpDays: 30,
        limit: 10,
      },
      caveats: ['Los resultados son descriptivos y observacionales; no prueban efectividad comparativa ni causalidad.'],
      summary: {
        matchedPatients: 12,
        matchedEncounters: 18,
        structuredTreatmentCount: 14,
        structuredTreatmentCoverage: 14 / 18,
        reconsultWithinWindowCount: 7,
        reconsultWithinWindowRate: 0.4,
        treatmentAdjustmentCount: 4,
        treatmentAdjustmentRate: 0.2,
        resolvedProblemCount: 3,
        resolvedProblemRate: 0.15,
        alertAfterIndexCount: 2,
        alertAfterIndexRate: 0.1,
        adherenceDocumentedCount: 8,
        adherenceDocumentedRate: 0.44,
        adverseEventCount: 1,
        adverseEventRate: 0.05,
        demographics: {
          averageAge: 51,
          bySex: { F: 8, M: 4 },
        },
      },
      topConditions: [{ label: 'Hipertensión arterial', encounterCount: 10, patientCount: 7, badge: 'Afección probable' }],
      cohortBreakdown: {
        associatedSymptoms: [{ label: 'Vómitos', encounterCount: 6, patientCount: 6 }],
        foodRelation: [{ label: 'Asociado a comida', encounterCount: 5, patientCount: 5 }],
      },
      treatmentPatterns: {
        medications: [{ label: 'Enalapril', encounterCount: 6, patientCount: 5 }],
        exams: [{ label: 'Perfil lipídico', encounterCount: 4, patientCount: 4 }],
        referrals: [],
      },
      treatmentOutcomeProxies: {
        medications: [
          {
            label: 'Tratamiento A',
            patientCount: 4,
            encounterCount: 4,
            favorableCount: 2,
            favorableRate: 0.5,
            adjustmentCount: 1,
            reconsultCount: 1,
            adherenceCount: 3,
            adverseEventCount: 0,
          },
        ],
        exams: [],
        referrals: [],
      },
      outcomeProxies: {
        reconsultWithinWindowRate: 0.4,
        treatmentAdjustmentRate: 0.2,
        resolvedProblemRate: 0.15,
        alertAfterIndexRate: 0.1,
      },
    });

    const csv = await exportClinicalAnalyticsSummaryCsvReadModel({
      prisma: {} as never,
      auditService: auditService as never,
      user: {
        id: 'med-1',
        email: 'medico@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: {
        condition: 'dolor abdominal',
        source: 'ANY',
        fromDate: '2026-04-01',
        toDate: '2026-04-20',
        followUpDays: 30,
        limit: 10,
      },
    });

    expect(getClinicalAnalyticsSummaryReadModel).toHaveBeenCalledWith({
      prisma: {},
      user: {
        id: 'med-1',
        email: 'medico@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: {
        condition: 'dolor abdominal',
        source: 'ANY',
        fromDate: '2026-04-01',
        toDate: '2026-04-20',
        followUpDays: 30,
        limit: 10,
      },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ClinicalAnalyticsSummaryExport',
        entityId: 'csv',
        userId: 'med-1',
        action: 'EXPORT',
      }),
    );
    expect(csv).toContain('Hipertensión arterial');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
});