import { AuditService } from '../audit/audit.service';
import { toCsvCell } from '../patients/patients-format';
import { getClinicalAnalyticsCasesReadModel } from './clinical-analytics.cases.read-model';
import type { RequestUser } from '../common/utils/medico-id';
import type { PrismaService } from '../prisma/prisma.service';
import type { ClinicalAnalyticsCasesQueryDto } from './dto/clinical-analytics-cases-query.dto';

type ClinicalAnalyticsCaseRow = Awaited<ReturnType<typeof getClinicalAnalyticsCasesReadModel>>['data'][number];

function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function joinValues(values: string[]) {
  return values.length > 0 ? values.join(' | ') : null;
}

function formatBooleanLabel(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return value ? 'Sí' : 'No';
}

function buildCsvRow(row: ClinicalAnalyticsCaseRow) {
  return [
    row.encounterId,
    row.patientId,
    row.patientName,
    row.patientRut,
    formatDateTime(row.createdAt),
    row.status,
    row.patientAge,
    row.patientSex,
    row.patientPrevision,
    row.episodeId,
    row.episodeLabel,
    formatDateOnly(row.episodeStartDate),
    formatDateOnly(row.episodeEndDate),
    formatBooleanLabel(row.episodeIsActive),
    joinValues(row.conditions),
    joinValues(row.diagnoses),
    joinValues(row.medications),
    joinValues(row.exams),
    joinValues(row.referrals),
    joinValues(row.symptoms),
    row.foodRelation,
    formatBooleanLabel(row.hasTreatmentAdjustment),
    formatBooleanLabel(row.hasFavorableResponse),
    row.outcomeStatus,
    row.outcomeSource,
    row.adherenceStatus,
    row.adverseEventSeverity,
    formatBooleanLabel(row.hasAdverseEvent),
  ].map((value) => toCsvCell(value)).join(',');
}

export async function exportClinicalAnalyticsCasesCsvReadModel(params: {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  query: ClinicalAnalyticsCasesQueryDto;
}) {
  const { auditService, query, prisma, user } = params;
  const csvQuery: ClinicalAnalyticsCasesQueryDto = {
    ...query,
    page: 1,
    pageSize: Number.MAX_SAFE_INTEGER,
  };
  const result = await getClinicalAnalyticsCasesReadModel({ prisma, user, query: csvQuery });
  const rows = result.data.map(buildCsvRow);

  await auditService.log({
    entityType: 'ClinicalAnalyticsCasesExport',
    entityId: 'csv',
    userId: user.id,
    action: 'EXPORT',
    diff: {
      export: {
        format: 'csv',
        caseCount: result.pagination.total,
        filters: result.filters,
        focus: result.focus,
      },
    },
  });

  const header = [
    'Encuentro ID',
    'Paciente ID',
    'Paciente',
    'RUT',
    'Fecha atención',
    'Estado',
    'Edad',
    'Sexo',
    'Previsión',
    'Episodio ID',
    'Episodio',
    'Episodio inicio',
    'Episodio fin',
    'Episodio activo',
    'Condiciones',
    'Diagnósticos',
    'Medicamentos',
    'Exámenes',
    'Derivaciones',
    'Síntomas',
    'Relación con comida',
    'Ajuste terapéutico',
    'Respuesta favorable proxy',
    'Resultado',
    'Origen resultado',
    'Adherencia',
    'Evento adverso severidad',
    'Evento adverso',
  ].map((value) => toCsvCell(value)).join(',');

  return '\uFEFF' + header + '\n' + rows.join('\n');
}