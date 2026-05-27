import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';
import { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';
import { getClinicalAnalyticsCasesReadModel } from './clinical-analytics.cases.read-model';
import { ClinicalAnalyticsCasesQueryDto } from './dto/clinical-analytics-cases-query.dto';
import { exportClinicalAnalyticsCasesCsvReadModel } from './clinical-analytics.cases.export';
import { exportClinicalAnalyticsSummaryCsvReadModel } from './clinical-analytics.summary.export';
import { exportClinicalAnalyticsSummaryMarkdownReadModel } from './clinical-analytics.summary.report';
import { getOperationalDailySummaryReadModel } from './operational-daily-summary.read-model';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private assertClinicalAnalyticsAccess(user: CurrentUserData) {
    if (user.role !== 'MEDICO' || user.isAdmin) {
      throw new ForbiddenException('La analítica clínica solo está disponible para médicos no administrativos');
    }
  }

  private buildAuditFilterSummary(query: ClinicalAnalyticsQueryDto | ClinicalAnalyticsCasesQueryDto) {
    return {
      source: query.source,
      fromDate: query.fromDate,
      toDate: query.toDate,
      followUpDays: query.followUpDays,
    };
  }

  private assertOperationalAnalyticsAccess(user: CurrentUserData) {
    if (!['MEDICO', 'ASISTENTE'].includes(user.role) || user.isAdmin) {
      throw new ForbiddenException('Los reportes operacionales requieren una cuenta clínica no administrativa');
    }
  }

  async getClinicalSummary(user: CurrentUserData, query: ClinicalAnalyticsQueryDto) {
    this.assertClinicalAnalyticsAccess(user);

    const summary = await getClinicalAnalyticsSummaryReadModel({
      prisma: this.prisma,
      user,
      query,
    });
    await this.auditService.log({
      entityType: 'ClinicalAnalyticsSummary',
      entityId: user.id,
      userId: user.id,
      action: 'READ',
      reason: 'CLINICAL_ANALYTICS_SUMMARY_VIEWED',
      diff: { scope: 'CLINICAL_ANALYTICS_SUMMARY', filters: this.buildAuditFilterSummary(query) },
    });
    return summary;
  }

  async getClinicalCases(user: CurrentUserData, query: ClinicalAnalyticsCasesQueryDto) {
    this.assertClinicalAnalyticsAccess(user);

    const cases = await getClinicalAnalyticsCasesReadModel({
      prisma: this.prisma,
      user,
      query,
    });
    await this.auditService.log({
      entityType: 'ClinicalAnalyticsCases',
      entityId: user.id,
      userId: user.id,
      action: 'READ',
      reason: 'CLINICAL_ANALYTICS_CASES_VIEWED',
      diff: {
        scope: 'CLINICAL_ANALYTICS_CASES',
        filters: this.buildAuditFilterSummary(query),
        count: cases.pagination.total,
      },
    });
    return cases;
  }

  exportClinicalCasesCsv(user: CurrentUserData, query: ClinicalAnalyticsCasesQueryDto) {
    this.assertClinicalAnalyticsAccess(user);

    return exportClinicalAnalyticsCasesCsvReadModel({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      query,
    });
  }

  exportClinicalSummaryCsv(user: CurrentUserData, query: ClinicalAnalyticsQueryDto) {
    this.assertClinicalAnalyticsAccess(user);

    return exportClinicalAnalyticsSummaryCsvReadModel({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      query,
    });
  }

  exportClinicalSummaryMarkdown(user: CurrentUserData, query: ClinicalAnalyticsQueryDto) {
    this.assertClinicalAnalyticsAccess(user);

    return exportClinicalAnalyticsSummaryMarkdownReadModel({
      prisma: this.prisma,
      auditService: this.auditService,
      user,
      query,
    });
  }

  async getOperationalDailySummary(user: CurrentUserData, date?: string) {
    this.assertOperationalAnalyticsAccess(user);
    const summary = await getOperationalDailySummaryReadModel({
      prisma: this.prisma,
      user,
      date,
    });
    await this.auditService.log({
      entityType: 'OperationalDailySummary',
      entityId: user.id,
      userId: user.id,
      action: 'READ',
      diff: { scope: 'OPERATIONAL_DAILY_SUMMARY', date: summary.date },
    });
    return summary;
  }
}
