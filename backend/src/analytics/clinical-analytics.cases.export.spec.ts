import { exportClinicalAnalyticsCasesCsvReadModel } from './clinical-analytics.cases.export';

jest.mock('./clinical-analytics.cases.read-model', () => ({
  getClinicalAnalyticsCasesReadModel: jest.fn(),
}));

import { getClinicalAnalyticsCasesReadModel } from './clinical-analytics.cases.read-model';

describe('clinical-analytics.cases.export', () => {
  it('exports filtered cases to a CSV and audits the download', async () => {
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    (getClinicalAnalyticsCasesReadModel as jest.Mock).mockResolvedValue({
      filters: {
        condition: 'dolor abdominal',
        source: 'ANY',
        fromDate: '2026-04-01',
        toDate: '2026-04-20',
        followUpDays: 30,
      },
      focus: {
        type: 'MEDICATION',
        value: 'Paracetamol',
      },
      pagination: {
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
        total: 2,
        totalPages: 1,
      },
      data: [
        {
          encounterId: 'enc-1',
          patientId: 'pat-1',
          episodeId: 'ep-1',
          episodeLabel: 'Gastritis',
          episodeStartDate: new Date('2026-04-10T12:00:00.000Z'),
          episodeEndDate: null,
          episodeIsActive: true,
          patientName: 'Paciente Demo',
          patientRut: '12.345.678-5',
          createdAt: new Date('2026-04-10T15:30:00.000Z'),
          status: 'COMPLETADO',
          patientAge: 42,
          patientSex: 'FEMENINO',
          patientPrevision: 'FONASA',
          conditions: ['Dolor abdominal funcional'],
          diagnoses: ['Gastritis'],
          medications: ['Paracetamol'],
          exams: ['Perfil lipídico'],
          referrals: [],
          symptoms: ['Náuseas'],
          foodRelation: 'Asociado a comida',
          outcomeStatus: 'FAVORABLE',
          outcomeSource: 'ESTRUCTURADO',
          adherenceStatus: 'ADHERENTE',
          adverseEventSeverity: null,
          hasTreatmentAdjustment: false,
          hasFavorableResponse: true,
          hasAdverseEvent: false,
        },
      ],
    });

    const csv = await exportClinicalAnalyticsCasesCsvReadModel({
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
        page: 1,
        pageSize: 15,
      },
    });

    expect(getClinicalAnalyticsCasesReadModel).toHaveBeenCalledWith({
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
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ClinicalAnalyticsCasesExport',
        entityId: 'csv',
        userId: 'med-1',
        action: 'EXPORT',
      }),
    );
    expect(csv).toContain('Paciente Demo');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
});