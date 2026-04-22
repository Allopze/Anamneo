'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiBarChart2, FiFileText, FiFilter, FiRefreshCw, FiUsers } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { AnalyticsOutcomeTable } from './AnalyticsOutcomeTable';
import { AnalyticsRankedTable } from './AnalyticsRankedTable';
import {
  buildClinicalAnalyticsCasesUrl,
  buildClinicalAnalyticsSummaryUrl,
  resolveClinicalAnalyticsFiltersFromSearchParams,
  resolveDefaultClinicalAnalyticsFilters,
  type ClinicalAnalyticsFilterState,
} from './analytics-filters';
import { downloadClinicalAnalyticsSummaryCsv, downloadClinicalAnalyticsSummaryMarkdown } from './summary-export';

type RankedRow = {
  label: string;
  encounterCount: number;
  patientCount: number;
  badge?: string;
  subtitle?: string;
};

type ClinicalAnalyticsResponse = {
  filters: {
    condition: string | null;
    source: 'ANY' | 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
    fromDate: string;
    toDate: string;
    followUpDays: number;
    limit: number;
  };
  caveats: string[];
  summary: {
    matchedPatients: number;
    matchedEncounters: number;
    structuredTreatmentCount: number;
    structuredTreatmentCoverage: number;
    reconsultWithinWindowCount: number;
    reconsultWithinWindowRate: number;
    treatmentAdjustmentCount: number;
    treatmentAdjustmentRate: number;
    resolvedProblemCount: number;
    resolvedProblemRate: number;
    alertAfterIndexCount: number;
    alertAfterIndexRate: number;
    adherenceDocumentedCount: number;
    adherenceDocumentedRate: number;
    adverseEventCount: number;
    adverseEventRate: number;
    demographics: {
      averageAge: number | null;
      bySex: Record<string, number>;
    };
  };
  topConditions: RankedRow[];
  cohortBreakdown: {
    associatedSymptoms: RankedRow[];
    foodRelation: RankedRow[];
  };
  treatmentPatterns: {
    medications: RankedRow[];
    exams: RankedRow[];
    referrals: RankedRow[];
  };
  treatmentOutcomeProxies: {
    medications: Array<{
      label: string;
      patientCount: number;
      encounterCount: number;
      favorableCount: number;
      favorableRate: number;
      adjustmentCount: number;
      reconsultCount: number;
      adherenceCount: number;
      adverseEventCount: number;
      subtitle?: string;
    }>;
    exams: Array<{
      label: string;
      patientCount: number;
      encounterCount: number;
      favorableCount: number;
      favorableRate: number;
      adjustmentCount: number;
      reconsultCount: number;
      adherenceCount: number;
      adverseEventCount: number;
      subtitle?: string;
    }>;
    referrals: Array<{
      label: string;
      patientCount: number;
      encounterCount: number;
      favorableCount: number;
      favorableRate: number;
      adjustmentCount: number;
      reconsultCount: number;
      adherenceCount: number;
      adverseEventCount: number;
      subtitle?: string;
    }>;
  };
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function AnaliticaClinicaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [isDownloadingMarkdown, setIsDownloadingMarkdown] = useState(false);
  const canAccess = user?.role === 'MEDICO' && !user?.isAdmin;
  const defaults = useMemo(() => resolveDefaultClinicalAnalyticsFilters(), []);
  const searchParamsKey = searchParams.toString();
  const appliedFilters = useMemo<ClinicalAnalyticsFilterState>(
    () => resolveClinicalAnalyticsFiltersFromSearchParams(new URLSearchParams(searchParamsKey), defaults),
    [defaults, searchParamsKey],
  );
  const [filters, setFilters] = useState<ClinicalAnalyticsFilterState>(appliedFilters);

  useEffect(() => {
    setFilters(appliedFilters);
  }, [appliedFilters]);

  const requestParams = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.condition.trim()) params.set('condition', appliedFilters.condition.trim());
    params.set('source', appliedFilters.source);
    params.set('fromDate', appliedFilters.fromDate);
    params.set('toDate', appliedFilters.toDate);
    params.set('followUpDays', appliedFilters.followUpDays);
    params.set('limit', appliedFilters.limit);
    return params;
  }, [appliedFilters]);

  const { data, isLoading, error } = useQuery<ClinicalAnalyticsResponse>({
    queryKey: ['clinical-analytics-summary', requestParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/analytics/clinical/summary?${requestParams}`);
      return response.data;
    },
    enabled: canAccess,
    retry: false,
  });

  if (!canAccess) {
    return (
      <RouteAccessGate
        when={true}
        href="/"
        title="Acceso restringido"
        description="Esta vista deriva datos de secciones clínicas sólo-médico y no está disponible para tu perfil."
        actionLabel="Volver al inicio"
      />
    );
  }

  const conditionRows = (data?.topConditions || []).map((row) => ({
    ...row,
    href: buildClinicalAnalyticsSummaryUrl({ ...appliedFilters, condition: row.label }),
    actionHref: buildClinicalAnalyticsCasesUrl({ ...appliedFilters, condition: row.label }),
    actionLabel: 'Ver casos',
  }));
  const medicationRows = (data?.treatmentPatterns.medications || []).map((row) => ({
    ...row,
    actionHref: buildClinicalAnalyticsCasesUrl(appliedFilters, { type: 'MEDICATION', value: row.label }),
    actionLabel: 'Ver casos',
  }));
  const symptomRows = (data?.cohortBreakdown.associatedSymptoms || []).map((row) => ({
    ...row,
    actionHref: buildClinicalAnalyticsCasesUrl(appliedFilters, { type: 'SYMPTOM', value: row.label }),
    actionLabel: 'Ver casos',
  }));

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    try {
      await downloadClinicalAnalyticsSummaryCsv(appliedFilters);
      toast.success('CSV descargado');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    setIsDownloadingMarkdown(true);
    try {
      await downloadClinicalAnalyticsSummaryMarkdown(appliedFilters);
      toast.success('Reporte descargado');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDownloadingMarkdown(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Analítica clínica</h1>
          <p className="page-header-description">
            Cohortes por afección o síntoma, patrones de tratamiento y desenlaces proxy sobre atenciones completadas o firmadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            onClick={handleDownloadCsv}
            disabled={isDownloadingCsv || isLoading}
          >
            <FiBarChart2 className="h-4 w-4" />
            {isDownloadingCsv ? 'Descargando…' : 'Descargar resumen CSV'}
          </button>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            onClick={handleDownloadMarkdown}
            disabled={isDownloadingMarkdown || isLoading}
          >
            <FiFileText className="h-4 w-4" />
            {isDownloadingMarkdown ? 'Descargando…' : 'Descargar reporte'}
          </button>
        </div>
      </div>

      <section className="filter-surface">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-secondary">
          <FiFilter className="h-4 w-4" />
          Filtros clínicos
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input className="form-input xl:col-span-2" placeholder="Afección, síntoma o CIE10" value={filters.condition} onChange={(event) => setFilters((current) => ({ ...current, condition: event.target.value }))} />
          <select className="form-input" value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as ClinicalAnalyticsFilterState['source'] }))}>
            <option value="ANY">Todas las fuentes</option>
            <option value="AFECCION_PROBABLE">Afección probable</option>
            <option value="SOSPECHA_DIAGNOSTICA">Sospecha diagnóstica</option>
          </select>
          <input type="date" className="form-input" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} />
          <input type="date" className="form-input" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} />
          <select className="form-input" value={filters.followUpDays} onChange={(event) => setFilters((current) => ({ ...current, followUpDays: event.target.value }))}>
            <option value="7">Seguimiento 7 días</option>
            <option value="30">Seguimiento 30 días</option>
            <option value="90">Seguimiento 90 días</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => router.push(buildClinicalAnalyticsSummaryUrl(filters))}>Actualizar vista</button>
          <button type="button" className="btn btn-secondary" onClick={() => router.push(buildClinicalAnalyticsSummaryUrl(defaults))}>Limpiar filtros</button>
          <button type="button" className="btn btn-secondary" onClick={() => router.push(buildClinicalAnalyticsCasesUrl(appliedFilters))}>Ver casos</button>
        </div>
      </section>

      {error ? <ErrorAlert message={getErrorMessage(error)} /> : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, index) => <div key={index} className="h-32 rounded-card skeleton" />)}
        </div>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="Pacientes" value={String(data.summary.matchedPatients)} icon={<FiUsers className="h-5 w-5" />} detail={`Edad promedio: ${data.summary.demographics.averageAge !== null ? Math.round(data.summary.demographics.averageAge) : '—'} años`} />
            <MetricCard title="Atenciones" value={String(data.summary.matchedEncounters)} icon={<FiBarChart2 className="h-5 w-5" />} detail={`Fuente: ${data.filters.source === 'ANY' ? 'mixta' : data.filters.source.toLowerCase().replace(/_/g, ' ')}`} />
            <MetricCard title="Cobertura estructurada" value={formatPercent(data.summary.structuredTreatmentCoverage)} icon={<FiRefreshCw className="h-5 w-5" />} detail={`${data.summary.structuredTreatmentCount} de ${data.summary.matchedEncounters} atenciones con medicamentos, exámenes o derivaciones estructuradas`} />
            <MetricCard title={`Reconsulta <= ${data.filters.followUpDays}d`} value={formatPercent(data.summary.reconsultWithinWindowRate)} icon={<FiUsers className="h-5 w-5" />} detail={`${data.summary.reconsultWithinWindowCount} de ${data.summary.matchedEncounters} atenciones reconsultaron en la ventana`} />
            <MetricCard title="Ajuste terapéutico" value={formatPercent(data.summary.treatmentAdjustmentRate)} icon={<FiRefreshCw className="h-5 w-5" />} detail={`${data.summary.treatmentAdjustmentCount} de ${data.summary.matchedEncounters} atenciones con ajuste posterior`} />
            <MetricCard title="Problema resuelto" value={formatPercent(data.summary.resolvedProblemRate)} icon={<FiAlertTriangle className="h-5 w-5" />} detail={`${data.summary.resolvedProblemCount} de ${data.summary.matchedEncounters} atenciones con problema resuelto. Alerta posterior: ${data.summary.alertAfterIndexCount} de ${data.summary.matchedEncounters}.`} />
            <MetricCard title="Adherencia documentada" value={formatPercent(data.summary.adherenceDocumentedRate)} icon={<FiUsers className="h-5 w-5" />} detail={`${data.summary.adherenceDocumentedCount} de ${data.summary.matchedEncounters} atenciones con adherencia registrada por tratamiento`} />
            <MetricCard title="Eventos adversos" value={formatPercent(data.summary.adverseEventRate)} icon={<FiAlertTriangle className="h-5 w-5" />} detail={`${data.summary.adverseEventCount} de ${data.summary.matchedEncounters} atenciones con evento adverso documentado`} />
          </section>

          <section className="card">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-status-yellow/20 p-2 text-status-yellow-text">
                <FiAlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">Lectura clínica responsable</h2>
                <ul className="mt-2 space-y-2 text-sm text-ink-secondary">
                  {data.caveats.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <AnalyticsRankedTable title="Cohortes principales" description="Afecciones más frecuentes en la ventana observada. Haz clic para fijar la cohorte." rows={conditionRows} emptyMessage="No hay afecciones con datos suficientes para esta ventana." />
            <AnalyticsRankedTable title="Medicamentos estructurados" description="Patrones terapéuticos observados en la cohorte filtrada." rows={medicationRows} emptyMessage="No hay medicamentos estructurados para esta cohorte." />
            <AnalyticsRankedTable title="Síntomas asociados" description="Subgrupos observados dentro de la cohorte filtrada, útil para consultas como dolor abdominal con vómitos o diarrea." rows={symptomRows} emptyMessage="No hay síntomas asociados reconocibles para esta cohorte." />
            <AnalyticsRankedTable title="Relación con comida" description="Clasificación heurística desde motivo, anamnesis próxima y revisión gastrointestinal." rows={data.cohortBreakdown.foodRelation} emptyMessage="No hay señales suficientes sobre asociación con comida en esta cohorte." />
            <AnalyticsRankedTable title="Exámenes estructurados" description="Solicitudes diagnósticas registradas en tratamiento." rows={data.treatmentPatterns.exams} emptyMessage="No hay exámenes estructurados para esta cohorte." />
            <AnalyticsRankedTable title="Derivaciones estructuradas" description="Escalamiento y referencia registrados en tratamiento." rows={data.treatmentPatterns.referrals} emptyMessage="No hay derivaciones estructuradas para esta cohorte." />
          </section>

          <AnalyticsOutcomeTable
            title="Medicamentos con respuesta favorable proxy"
            description="Resume cuántas veces cada medicamento estructurado quedó asociado a una evolución favorable proxy dentro de la ventana de seguimiento."
            rows={data.treatmentOutcomeProxies.medications}
            emptyMessage="No hay medicamentos estructurados suficientes para estimar respuesta favorable proxy en esta cohorte."
          />

          <AnalyticsOutcomeTable
            title="Exámenes con respuesta favorable proxy"
            description="Resume cuántas veces cada examen estructurado quedó asociado a una evolución favorable proxy dentro de la ventana de seguimiento."
            rows={data.treatmentOutcomeProxies.exams}
            emptyMessage="No hay exámenes estructurados suficientes para estimar respuesta favorable proxy en esta cohorte."
          />

          <AnalyticsOutcomeTable
            title="Derivaciones con respuesta favorable proxy"
            description="Resume cuántas veces cada derivación estructurada quedó asociada a una evolución favorable proxy dentro de la ventana de seguimiento."
            rows={data.treatmentOutcomeProxies.referrals}
            emptyMessage="No hay derivaciones estructuradas suficientes para estimar respuesta favorable proxy en esta cohorte."
          />
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="metric-card flex items-start gap-3">
      <div className="rounded-full bg-surface-inset p-3 text-ink-secondary">{icon}</div>
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">{title}</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
        <p className="mt-2 text-sm text-ink-secondary">{detail}</p>
      </div>
    </div>
  );
}