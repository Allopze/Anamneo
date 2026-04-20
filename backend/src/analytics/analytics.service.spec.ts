jest.mock('./clinical-analytics.read-model', () => ({
  getClinicalAnalyticsSummaryReadModel: jest.fn(() => ({ ok: true })),
}));

jest.mock('./clinical-analytics.cases.read-model', () => ({
  getClinicalAnalyticsCasesReadModel: jest.fn(() => ({ ok: 'cases' })),
}));

import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';
import { getClinicalAnalyticsCasesReadModel } from './clinical-analytics.cases.read-model';

describe('AnalyticsService', () => {
  it('rejects MEDICO users flagged as admin to match frontend access rules', () => {
    const service = new AnalyticsService({} as any);

    expect(() =>
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
    ).toThrow(ForbiddenException);
  });

  it('delegates to the read model for non-admin doctors', () => {
    const service = new AnalyticsService({} as any);

    const result = service.getClinicalSummary(
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
  });

  it('delegates drill-down cases to the cases read model for non-admin doctors', () => {
    const service = new AnalyticsService({} as any);

    const result = service.getClinicalCases(
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
    expect(result).toEqual({ ok: 'cases' });
  });
});