'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiDownload, FiFileText, FiUsers } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import {
  buildClinicalAnalyticsCasesUrl,
  buildClinicalAnalyticsSummaryUrl,
  resolveClinicalAnalyticsFiltersFromSearchParams,
  resolveDefaultClinicalAnalyticsFilters,
} from '../analytics-filters';
import { AnalyticsCasesTable, type AnalyticsCaseRow } from './AnalyticsCasesTable';
import { downloadClinicalAnalyticsCasesCsv } from '@/app/(dashboard)/analitica-clinica/casos/analytics-cases-export';

type ClinicalAnalyticsCasesResponse = {
  filters: {
    condition: string | null;
    source: 'ANY' | 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
    fromDate: string;
    toDate: string;
    followUpDays: number;
  };
  focus: {
    type: 'MEDICATION' | 'SYMPTOM' | null;
    value: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  data: AnalyticsCaseRow[];
};

function describeFocus(response: ClinicalAnalyticsCasesResponse) {
  if (response.focus.type === 'MEDICATION' && response.focus.value) {
    return `Casos de la cohorte actual donde se indicó ${response.focus.value}.`;
  }

  if (response.focus.type === 'SYMPTOM' && response.focus.value) {
    return `Casos de la cohorte actual donde apareció el síntoma ${response.focus.value}.`;
  }

  if (response.filters.condition) {
    return `Casos clínicos observados para la cohorte ${response.filters.condition}.`;
  }

  return 'Casos clínicos observados dentro de la ventana y filtros actuales.';
}

export default function ClinicalAnalyticsCasesPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const canAccess = user?.role === 'MEDICO' && !user?.isAdmin;
  const defaults = useMemo(() => resolveDefaultClinicalAnalyticsFilters(), []);
  const searchParamsKey = searchParams.toString();
  const parsedSearchParams = useMemo(() => new URLSearchParams(searchParamsKey), [searchParamsKey]);
  const filters = useMemo(
    () => resolveClinicalAnalyticsFiltersFromSearchParams(parsedSearchParams, defaults),
    [defaults, parsedSearchParams],
  );
  const focusType = parsedSearchParams.get('focusType') as 'MEDICATION' | 'SYMPTOM' | null;
  const focusValue = parsedSearchParams.get('focusValue') || '';
  const page = Number(parsedSearchParams.get('page') || '1');
  const activeFocus = focusType && focusValue.trim() ? { type: focusType, value: focusValue.trim() } : undefined;

  const requestParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.condition.trim()) params.set('condition', filters.condition.trim());
    params.set('source', filters.source);
    params.set('fromDate', filters.fromDate);
    params.set('toDate', filters.toDate);
    params.set('followUpDays', filters.followUpDays);
    params.set('page', String(page));
    if (focusType && focusValue.trim()) {
      params.set('focusType', focusType);
      params.set('focusValue', focusValue.trim());
    }
    return params;
  }, [filters, focusType, focusValue, page]);

  const { data, isLoading, error } = useQuery<ClinicalAnalyticsCasesResponse>({
    queryKey: ['clinical-analytics-cases', requestParams.toString()],
    queryFn: async () => {
      const response = await api.get(`/analytics/clinical/cases?${requestParams}`);
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

  const previousPageHref = buildClinicalAnalyticsCasesUrl(
    filters,
    activeFocus,
    Math.max(1, page - 1),
  );
  const nextPageHref = buildClinicalAnalyticsCasesUrl(
    filters,
    activeFocus,
    page + 1,
  );

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    try {
      await downloadClinicalAnalyticsCasesCsv(filters, activeFocus);
      toast.success('CSV descargado');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Casos analíticos</h1>
          <p className="page-header-description">
            {data ? describeFocus(data) : 'Explora las atenciones concretas que componen una cohorte, síntoma o patrón terapéutico.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            onClick={handleDownloadCsv}
            disabled={isDownloadingCsv || isLoading}
          >
            <FiDownload className="h-4 w-4" />
            {isDownloadingCsv ? 'Descargando…' : 'Descargar CSV'}
          </button>

          <Link
            href={buildClinicalAnalyticsSummaryUrl(filters)}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <FiArrowLeft className="h-4 w-4" />
            Volver a la analítica
          </Link>
        </div>
      </div>

      {error ? <ErrorAlert message={getErrorMessage(error)} /> : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-48 rounded-card skeleton" />
          ))}
        </div>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric-card flex items-start gap-3">
              <div className="rounded-full bg-surface-inset p-3 text-ink-secondary">
                <FiFileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">Atenciones</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{data.pagination.total}</p>
                <p className="mt-2 text-sm text-ink-secondary">Casos clínicos coincidentes con filtros y foco actual.</p>
              </div>
            </div>

            <div className="metric-card flex items-start gap-3">
              <div className="rounded-full bg-surface-inset p-3 text-ink-secondary">
                <FiUsers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">Página</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{data.pagination.page}</p>
                <p className="mt-2 text-sm text-ink-secondary">{data.pagination.pageSize} filas por página.</p>
              </div>
            </div>

            <div className="metric-card flex items-start gap-3">
              <div className="rounded-full bg-surface-inset p-3 text-ink-secondary">
                <FiFileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">Foco actual</p>
                <p className="mt-2 text-lg font-extrabold tracking-tight text-ink">{data.focus.value || data.filters.condition || 'Cohorte filtrada'}</p>
                <p className="mt-2 text-sm text-ink-secondary">Fuente: {data.filters.source === 'ANY' ? 'mixta' : data.filters.source.toLowerCase().replace(/_/g, ' ')}</p>
              </div>
            </div>
          </section>

          {data.data.length > 0 ? (
            <>
              <AnalyticsCasesTable rows={data.data} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-secondary">
                  Página {data.pagination.page} de {data.pagination.totalPages}
                </p>

                <div className="flex gap-2">
                  <Link
                    href={previousPageHref}
                    className={`btn btn-secondary ${data.pagination.page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    Anterior
                  </Link>
                  <Link
                    href={nextPageHref}
                    className={`btn btn-secondary ${data.pagination.page >= data.pagination.totalPages ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    Siguiente
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <section className="card">
              <h2 className="text-lg font-bold text-ink">Sin casos</h2>
              <p className="mt-2 text-sm text-ink-secondary">
                No hay atenciones que coincidan con este foco dentro de la ventana seleccionada.
              </p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}