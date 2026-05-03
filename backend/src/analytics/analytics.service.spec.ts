jest.mock('./clinical-analytics.read-model', () => ({
  getClinicalAnalyticsSummaryReadModel: jest.fn(() => ({ ok: true })),
}));

jest.mock('./clinical-analytics.cases.read-model', () => ({
  getClinicalAnalyticsCasesReadModel: jest.fn(() => ({ ok: 'cases', pagination: { total: 2 } })),
}));

jest.mock('./clinical-analytics.cases.export', () => ({
  exportClinicalAnalyticsCasesCsvReadModel: jest.fn(() => 'csv-content'),
}));

jest.mock('./clinical-analytics.summary.export', () => ({
  exportClinicalAnalyticsSummaryCsvReadModel: jest.fn(() => 'summary-csv-content'),
}));

jest.mock('./clinical-analytics.summary.report', () => ({
  exportClinicalAnalyticsSummaryMarkdownReadModel: jest.fn(() => 'summary-md-content'),
}));

import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';
import { getClinicalAnalyticsCasesReadModel } from './clinical-analytics.cases.read-model';
import { exportClinicalAnalyticsCasesCsvReadModel } from './clinical-analytics.cases.export';
import { exportClinicalAnalyticsSummaryCsvReadModel } from './clinical-analytics.summary.export';
import { exportClinicalAnalyticsSummaryMarkdownReadModel } from './clinical-analytics.summary.report';

describe('AnalyticsService', () => {
  it('rejects MEDICO users flagged as admin to match frontend access rules', async () => {
    const service = new AnalyticsService({} as any, {} as any);

    await expect(
      service.getClinicalSummary(
        {
          id: 'med-admin-1',
          email: 'med-admin@test.com',
          nombre: 'Medico Admin',
          role: 'MEDICO',
          isAdmin: true,
        },
        { source: 'ANY', followUpDays: 30, limit: 10 },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('delegates to the read model for non-admin doctors', async () => {
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new AnalyticsService({} as any, auditService as any);

    const result = await service.getClinicalSummary(
      {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      { source: 'ANY', followUpDays: 30, limit: 10 },
    );

    expect(getClinicalAnalyticsSummaryReadModel).toHaveBeenCalledWith({
      prisma: {},
      user: {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: { source: 'ANY', followUpDays: 30, limit: 10 },
    });
    expect(result).toEqual({ ok: true });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ClinicalAnalyticsSummary',
        entityId: 'med-1',
        userId: 'med-1',
        action: 'READ',
        reason: 'CLINICAL_ANALYTICS_SUMMARY_VIEWED',
        diff: {
          scope: 'CLINICAL_ANALYTICS_SUMMARY',
          filters: {
            source: 'ANY',
            fromDate: undefined,
            toDate: undefined,
            followUpDays: 30,
          },
        },
      }),
    );
  });

  it('delegates drill-down cases to the cases read model for non-admin doctors', async () => {
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new AnalyticsService({} as any, auditService as any);

    const result = await service.getClinicalCases(
      {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      { source: 'ANY', followUpDays: 30, page: 1, pageSize: 15 },
    );

    expect(getClinicalAnalyticsCasesReadModel).toHaveBeenCalledWith({
      prisma: {},
      user: {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: { source: 'ANY', followUpDays: 30, page: 1, pageSize: 15 },
    });
    expect(result).toEqual({ ok: 'cases', pagination: { total: 2 } });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ClinicalAnalyticsCases',
        entityId: 'med-1',
        userId: 'med-1',
        action: 'READ',
        reason: 'CLINICAL_ANALYTICS_CASES_VIEWED',
        diff: {
          scope: 'CLINICAL_ANALYTICS_CASES',
          filters: {
            source: 'ANY',
            fromDate: undefined,
            toDate: undefined,
            followUpDays: 30,
          },
          count: 2,
        },
      }),
    );
  });

  it('delegates clinical cases CSV export to the export read model for non-admin doctors', () => {
    const auditService = { log: jest.fn() };
    const service = new AnalyticsService({} as any, auditService as any);

    const result = service.exportClinicalCasesCsv(
      {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      { source: 'ANY', followUpDays: 30, page: 1, pageSize: 15 },
    );

    expect(exportClinicalAnalyticsCasesCsvReadModel).toHaveBeenCalledWith({
      prisma: {},
      auditService,
      user: {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: { source: 'ANY', followUpDays: 30, page: 1, pageSize: 15 },
    });
    expect(result).toEqual('csv-content');
  });

  it('delegates clinical summary CSV export to the export read model for non-admin doctors', () => {
    const auditService = { log: jest.fn() };
    const service = new AnalyticsService({} as any, auditService as any);

    const result = service.exportClinicalSummaryCsv(
      {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      { source: 'ANY', followUpDays: 30, limit: 10 },
    );

    expect(exportClinicalAnalyticsSummaryCsvReadModel).toHaveBeenCalledWith({
      prisma: {},
      auditService,
      user: {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: { source: 'ANY', followUpDays: 30, limit: 10 },
    });
    expect(result).toEqual('summary-csv-content');
  });

  it('delegates clinical summary Markdown export to the export read model for non-admin doctors', () => {
    const auditService = { log: jest.fn() };
    const service = new AnalyticsService({} as any, auditService as any);

    const result = service.exportClinicalSummaryMarkdown(
      {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      { source: 'ANY', followUpDays: 30, limit: 10 },
    );

    expect(exportClinicalAnalyticsSummaryMarkdownReadModel).toHaveBeenCalledWith({
      prisma: {},
      auditService,
      user: {
        id: 'med-1',
        email: 'med@test.com',
        nombre: 'Medico Demo',
        role: 'MEDICO',
        isAdmin: false,
      },
      query: { source: 'ANY', followUpDays: 30, limit: 10 },
    });
    expect(result).toEqual('summary-md-content');
  });
});
