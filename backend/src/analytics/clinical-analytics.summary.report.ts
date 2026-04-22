import { AuditService } from '../audit/audit.service';
import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';
import type { RequestUser } from '../common/utils/medico-id';
import type { PrismaService } from '../prisma/prisma.service';
import type { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  return `${Math.round(value * 100)}%`;
}

function formatRankedRow(row: { label: string; encounterCount: number; patientCount: number; badge?: string; subtitle?: string }) {
  const pieces = [`- ${row.label} (${row.encounterCount} atenciones / ${row.patientCount} pacientes)`];
  if (row.badge) {
    pieces.push(row.badge);
  }
  if (row.subtitle) {
    pieces.push(row.subtitle);
  }
  return pieces.join(' - ');
}

function formatOutcomeRow(row: { label: string; encounterCount: number; patientCount: number; favorableRate: number; adjustmentCount: number; reconsultCount: number; adherenceCount: number; adverseEventCount: number; subtitle?: string }) {
  const pieces = [
    `- ${row.label} (${row.encounterCount} atenciones / ${row.patientCount} pacientes)`,
    `favorables ${formatPercent(row.favorableRate)}`,
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

function buildSection(title: string, items: string[]) {
  if (items.length === 0) {
    return `## ${title}\n\nSin datos relevantes.\n`;
  }

  return `## ${title}\n\n${items.join('\n')}\n`;
}

function formatBySex(bySex: Record<string, number>) {
  const entries = Object.entries(bySex);
  if (entries.length === 0) {
    return 'Sin dato';
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join(' | ');
}

export async function exportClinicalAnalyticsSummaryMarkdownReadModel(params: {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  query: ClinicalAnalyticsQueryDto;
}) {
  const { auditService, prisma, query, user } = params;
  const result = await getClinicalAnalyticsSummaryReadModel({ prisma, user, query });

  await auditService.log({
    entityType: 'ClinicalAnalyticsSummaryReportExport',
    entityId: 'md',
    userId: user.id,
    action: 'EXPORT',
    diff: {
      export: {
        format: 'md',
        filters: result.filters,
        summary: result.summary,
      },
    },
  });

  const title = '# Reporte de analítica clínica';
  const subtitle = `Periodo ${result.filters.fromDate} a ${result.filters.toDate}`;
  const filters = [
    `- Condición: ${result.filters.condition || 'todas'}`,
    `- Fuente: ${result.filters.source}`,
    `- Seguimiento: ${result.filters.followUpDays} días`,
    `- Límite: ${result.filters.limit}`,
  ];
  const summary = [
    `- Pacientes: ${result.summary.matchedPatients}`,
    `- Atenciones: ${result.summary.matchedEncounters}`,
    `- Cobertura estructurada: ${formatPercent(result.summary.structuredTreatmentCoverage)}`,
    `- Reconsulta en ventana: ${formatPercent(result.summary.reconsultWithinWindowRate)} (${result.summary.reconsultWithinWindowCount})`,
    `- Ajuste terapéutico: ${formatPercent(result.summary.treatmentAdjustmentRate)} (${result.summary.treatmentAdjustmentCount})`,
    `- Problema resuelto: ${formatPercent(result.summary.resolvedProblemRate)} (${result.summary.resolvedProblemCount})`,
    `- Alerta posterior: ${formatPercent(result.summary.alertAfterIndexRate)} (${result.summary.alertAfterIndexCount})`,
    `- Adherencia documentada: ${formatPercent(result.summary.adherenceDocumentedRate)} (${result.summary.adherenceDocumentedCount})`,
    `- Evento adverso: ${formatPercent(result.summary.adverseEventRate)} (${result.summary.adverseEventCount})`,
    `- Edad promedio: ${result.summary.demographics.averageAge !== null ? Math.round(result.summary.demographics.averageAge) : '—'}`,
    `- Sexo: ${formatBySex(result.summary.demographics.bySex)}`,
  ];

  const content = [
    title,
    '',
    subtitle,
    '',
    '## Filtros',
    '',
    ...filters,
    '',
    '## Resumen ejecutivo',
    '',
    ...summary,
    '',
    buildSection('Cohortes principales', result.topConditions.map(formatRankedRow)),
    buildSection('Síntomas asociados', result.cohortBreakdown.associatedSymptoms.map(formatRankedRow)),
    buildSection('Relación con comida', result.cohortBreakdown.foodRelation.map(formatRankedRow)),
    buildSection('Patrones de tratamiento - Medicamentos', result.treatmentPatterns.medications.map(formatRankedRow)),
    buildSection('Patrones de tratamiento - Exámenes', result.treatmentPatterns.exams.map(formatRankedRow)),
    buildSection('Patrones de tratamiento - Derivaciones', result.treatmentPatterns.referrals.map(formatRankedRow)),
    buildSection('Desenlaces proxy - Medicamentos', result.treatmentOutcomeProxies.medications.map(formatOutcomeRow)),
    buildSection('Desenlaces proxy - Exámenes', result.treatmentOutcomeProxies.exams.map(formatOutcomeRow)),
    buildSection('Desenlaces proxy - Derivaciones', result.treatmentOutcomeProxies.referrals.map(formatOutcomeRow)),
    '## Nota',
    '',
    ...result.caveats.map((caveat) => `- ${caveat}`),
    '',
  ];

  return content.join('\n');
}