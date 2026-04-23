import { AuditService } from '../audit/audit.service';
import { toCsvCell } from '../patients/patients-format';
import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';
import type { RequestUser } from '../common/utils/medico-id';
import type { PrismaService } from '../prisma/prisma.service';
import type { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return `${Math.round(value * 100)}%`;
}

function formatRankedRow(row: { label: string; encounterCount: number; patientCount: number; badge?: string; subtitle?: string }) {
  const pieces = [`${row.label} [${row.encounterCount}/${row.patientCount}]`];
  if (row.badge) {
    pieces.push(row.badge);
  }
  if (row.subtitle) {
    pieces.push(row.subtitle);
  }
  return pieces.join(' - ');
}

function formatOutcomeRow(row: { label: string; encounterCount: number; patientCount: number; favorableCount: number; favorableRate: number; adjustmentCount: number; reconsultCount: number; adherenceCount: number; adverseEventCount: number; subtitle?: string }) {
  const pieces = [
    `${row.label} [${row.encounterCount}/${row.patientCount}]`,
    `favorable ${formatPercent(row.favorableRate) || '-'}`,
    `ajustes ${row.adjustmentCount}`,
    `reconsultas ${row.reconsultCount}`,
    `adherencia ${row.adherenceCount}`,
    `eventos adversos ${row.adverseEventCount}`,
  ];

  if (row.subtitle) {
    pieces.push(row.subtitle);
  }

  return pieces.join(' - ');
}

function joinRows<T>(rows: T[], formatter: (row: T) => string) {
  return rows.length > 0 ? rows.map(formatter).join(' | ') : null;
}

function stringifyBySex(bySex: Record<string, number>) {
  return Object.entries(bySex)
    .map(([key, value]) => `${key}:${value}`)
    .join(' | ') || null;
}

export async function exportClinicalAnalyticsSummaryCsvReadModel(params: {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  query: ClinicalAnalyticsQueryDto;
}) {
  const { auditService, prisma, query, user } = params;
  const result = await getClinicalAnalyticsSummaryReadModel({ prisma, user, query });

  await auditService.log({
    entityType: 'ClinicalAnalyticsSummaryExport',
    entityId: 'csv',
    userId: user.id,
    action: 'EXPORT',
    diff: {
      export: {
        format: 'csv',
        filters: result.filters,
        summary: result.summary,
      },
    },
  });

  const row = {
    condition: result.filters.condition,
    source: result.filters.source,
    fromDate: result.filters.fromDate,
    toDate: result.filters.toDate,
    followUpDays: result.filters.followUpDays,
    limit: result.filters.limit,
    matchedPatients: result.summary.matchedPatients,
    matchedEncounters: result.summary.matchedEncounters,
    structuredTreatmentCount: result.summary.structuredTreatmentCount,
    structuredTreatmentCoverage: formatPercent(result.summary.structuredTreatmentCoverage),
    reconsultWithinWindowCount: result.summary.reconsultWithinWindowCount,
    reconsultWithinWindowRate: formatPercent(result.summary.reconsultWithinWindowRate),
    treatmentAdjustmentCount: result.summary.treatmentAdjustmentCount,
    treatmentAdjustmentRate: formatPercent(result.summary.treatmentAdjustmentRate),
    resolvedProblemCount: result.summary.resolvedProblemCount,
    resolvedProblemRate: formatPercent(result.summary.resolvedProblemRate),
    alertAfterIndexCount: result.summary.alertAfterIndexCount,
    alertAfterIndexRate: formatPercent(result.summary.alertAfterIndexRate),
    adherenceDocumentedCount: result.summary.adherenceDocumentedCount,
    adherenceDocumentedRate: formatPercent(result.summary.adherenceDocumentedRate),
    adverseEventCount: result.summary.adverseEventCount,
    adverseEventRate: formatPercent(result.summary.adverseEventRate),
    averageAge: result.summary.demographics.averageAge,
    bySex: stringifyBySex(result.summary.demographics.bySex),
    topConditions: joinRows(result.topConditions, formatRankedRow),
    associatedSymptoms: joinRows(result.cohortBreakdown.associatedSymptoms, formatRankedRow),
    foodRelation: joinRows(result.cohortBreakdown.foodRelation, formatRankedRow),
    medications: joinRows(result.treatmentPatterns.medications, formatRankedRow),
    exams: joinRows(result.treatmentPatterns.exams, formatRankedRow),
    referrals: joinRows(result.treatmentPatterns.referrals, formatRankedRow),
    outcomeMedications: joinRows(result.treatmentOutcomeProxies.medications, formatOutcomeRow),
    outcomeExams: joinRows(result.treatmentOutcomeProxies.exams, formatOutcomeRow),
    outcomeReferrals: joinRows(result.treatmentOutcomeProxies.referrals, formatOutcomeRow),
    caveats: result.caveats.join(' | '),
  };

  const header = Object.keys(row).map((key) => toCsvCell(key)).join(',');
  const values = Object.values(row).map((value) => toCsvCell(value)).join(',');

  return '\uFEFF' + header + '\n' + values;
}