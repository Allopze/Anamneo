'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiFileText,
  FiFilter,
  FiList,
  FiPlus,
  FiSearch,
  FiUser,
} from 'react-icons/fi';
import { api } from '@/lib/api';
import { Encounter, REVIEW_STATUS_LABELS, STATUS_LABELS } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import {
  STATUS_OPTIONS,
  REVIEW_OPTIONS,
  PAGE_SIZE,
  type OperationalDashboardData,
  getStatusChipClassName,
  getReviewChipClassName,
} from './atenciones.constants';

export default function AtencionesListPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-fade-in">
          <div className="mb-6 h-8 w-48 rounded skeleton" />
          <div className="card">
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="h-16 rounded-lg skeleton" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <AtencionesListContent />
    </Suspense>
  );
}

function AtencionesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, canCreateEncounter, canCreatePatient } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const canCreate = canCreateEncounter();
  const canCreatePatientAllowed = canCreatePatient();
  const search = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(search);
  const page = Number(searchParams.get('page') || '1');
  const filters = {
    status: searchParams.get('status') || '',
    reviewStatus: searchParams.get('reviewStatus') || '',
  };
  const [showFilters, setShowFilters] = useState(Boolean(filters.status || filters.reviewStatus));
  const hasSearch = Boolean(search);
  const hasAdvancedFilters = Boolean(filters.status || filters.reviewStatus);
  const hasActiveCriteria = hasSearch || hasAdvancedFilters;

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (hasAdvancedFilters) {
      setShowFilters(true);
    }
  }, [hasAdvancedFilters]);

  if (isOperationalAdmin) {
    return (
      <RouteAccessGate
        when={true}
        title="Redirigiendo…"
        description="Esta bandeja clínica no está disponible para perfiles administrativos. Te llevamos al inicio."
        href="/"
        actionLabel="Ir al inicio"
      />
    );
  }

  const buildUrl = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { search, status: filters.status, reviewStatus: filters.reviewStatus, page: String(page), ...overrides };

    Object.entries(merged).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      if (key === 'page' && value === '1') {
        return;
      }

      next.set(key, value);
    });

    const queryString = next.toString();
    return `/atenciones${queryString ? `?${queryString}` : ''}`;
  };

  const setPage = (nextPage: number | ((previousPage: number) => number)) => {
    const resolvedPage = typeof nextPage === 'function' ? nextPage(page) : nextPage;
    router.push(buildUrl({ page: String(resolvedPage) }));
  };

  const setFilter = (key: 'status' | 'reviewStatus', value: string) => {
    router.push(buildUrl({ [key]: value, page: '1' }));
  };

  const clearFilters = () => {
    router.push(buildUrl({ status: '', reviewStatus: '', page: '1' }));
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(buildUrl({ search: searchInput.trim(), page: '1' }));
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['encounters', search, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', PAGE_SIZE.toString());
      if (search) params.set('search', search);
      if (filters.status) params.set('status', filters.status);
      if (filters.reviewStatus) params.set('reviewStatus', filters.reviewStatus);
      const response = await api.get(`/encounters?${params}`);
      return response.data;
    },
    enabled: !isOperationalAdmin,
  });

  const { data: operationalData } = useQuery<OperationalDashboardData>({
    queryKey: ['encounters-operational-summary'],
    queryFn: async () => {
      const response = await api.get('/encounters/stats/dashboard');
      return response.data;
    },
    enabled: !isOperationalAdmin,
    staleTime: 60_000,
  });

  if (isOperationalAdmin) {
    return null;
  }

  const hasEncounters = data?.data?.length > 0;
  const showEmptyCreateEncounterCta = canCreate && !isLoading && !error && !hasEncounters && !hasActiveCriteria;
  const showHeaderNewEncounter = canCreate && !showEmptyCreateEncounterCta;
  const showHeaderActions = showHeaderNewEncounter || canCreatePatientAllowed;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Atenciones</h1>
          <p className="page-header-description">
            Revisa el historial clínico activo con el mismo patrón de navegación que usas en pacientes.
          </p>
        </div>

        {showHeaderActions ? (
          <div className="flex flex-wrap items-center gap-2">
            {showHeaderNewEncounter ? (
              <Link href="/atenciones/nueva" className="btn btn-primary flex items-center gap-2">
                <FiPlus className="h-4 w-4" aria-hidden="true" />
                Nueva Atención
              </Link>
            ) : null}
            {canCreatePatientAllowed ? (
              <Link href="/pacientes/nuevo" className="btn btn-secondary flex items-center gap-2">
                <FiUser className="h-4 w-4" aria-hidden="true" />
                Nuevo Paciente
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {operationalData ? (
        <section className="mb-5 grid gap-3 md:grid-cols-3">
          <Link
            href="/atenciones?status=EN_PROGRESO"
            className="rounded-card bg-surface-elevated px-4 py-4 shadow-soft transition-colors hover:bg-surface-inset/40"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">En curso</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{operationalData.counts.enProgreso}</p>
            <p className="mt-2 text-sm text-ink-secondary">Atenciones abiertas dentro del circuito activo.</p>
          </Link>
          <Link
            href="/atenciones?reviewStatus=LISTA_PARA_REVISION"
            className="rounded-card bg-surface-elevated px-4 py-4 shadow-soft transition-colors hover:bg-surface-inset/40"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">Pendientes de revisión</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{operationalData.counts.pendingReview}</p>
            <p className="mt-2 text-sm text-ink-secondary">Casos listos para revisión o cierre médico.</p>
          </Link>
          <Link
            href="/pacientes?completenessStatus=PENDIENTE_VERIFICACION"
            className="rounded-card bg-surface-elevated px-4 py-4 shadow-soft transition-colors hover:bg-surface-inset/40"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">Fichas por validar</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{operationalData.counts.patientPendingVerification}</p>
            <p className="mt-2 text-sm text-ink-secondary">Recepción completó datos y espera validación médica.</p>
          </Link>
        </section>
      ) : null}

      <form onSubmit={handleSearch} className="mb-4">
        <label htmlFor="encounters-search" className="sr-only">
          Buscar atenciones por nombre o RUT del paciente
        </label>
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            id="encounters-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nombre o RUT del paciente…"
            className="form-input w-full pl-11"
            autoComplete="off"
          />
        </div>
      </form>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowFilters((current) => !current)}
          className="mb-2 flex items-center gap-2 text-body font-medium text-ink-secondary hover:text-ink"
        >
          <FiFilter className="h-4 w-4" aria-hidden="true" />
          Filtros avanzados
          {hasAdvancedFilters ? (
            <span className="list-chip bg-surface-base text-ink-secondary">
              {[filters.status, filters.reviewStatus].filter(Boolean).length} activos
            </span>
          ) : null}
          <FiChevronDown
            className={clsx('h-3 w-3 transition-transform', showFilters ? 'rotate-180' : '')}
            aria-hidden="true"
          />
        </button>

        {showFilters ? (
          <div className="filter-surface">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="encounter-status" className="block text-micro text-ink-muted mb-1">
                  Estado
                </label>
                <select
                  id="encounter-status"
                  className="input w-full text-sm"
                  value={filters.status}
                  onChange={(event) => setFilter('status', event.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="encounter-review-status" className="block text-micro text-ink-muted mb-1">
                  Revisión
                </label>
                <select
                  id="encounter-review-status"
                  className="input w-full text-sm"
                  value={filters.reviewStatus}
                  onChange={(event) => setFilter('reviewStatus', event.target.value)}
                >
                  {REVIEW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-micro text-ink-secondary">
                {hasAdvancedFilters ? 'Ajusta los filtros para afinar la lista.' : 'Sin filtros avanzados activos.'}
              </span>
              {hasAdvancedFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-micro text-ink-secondary transition-colors hover:text-ink hover:underline"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="card mb-6 rounded-card border border-status-red/30 bg-status-red/10 p-4 text-body text-status-red-text">
          Error al cargar atenciones. Intenta recargar la página.
        </div>
      ) : null}

      <div className="card transition-all duration-300">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="flex items-center gap-4 border-b border-surface-muted/20 p-4 last:border-b-0">
                <div className="h-12 w-12 rounded-icon skeleton" />
                <div className="flex-1">
                  <div className="mb-2 h-4 w-1/3 skeleton" />
                  <div className="h-3 w-1/2 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : hasEncounters ? (
          <>
            <div className="divide-y divide-surface-muted/30">
              {data.data.map((encounter: Encounter) => (
                <Link key={encounter.id} href={`/atenciones/${encounter.id}`} className="group list-row">
                  <div
                    className={clsx(
                      'list-row-icon h-12 w-12',
                      encounter.status === 'COMPLETADO'
                        ? 'bg-status-green/20 text-status-green'
                        : encounter.status === 'EN_PROGRESO'
                          ? 'border border-status-yellow/70 bg-status-yellow/35 text-accent-text'
                          : 'bg-surface-base text-ink-secondary'
                    )}
                  >
                    <FiFileText className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-ink group-hover:text-ink-secondary">
                        {encounter.patient?.nombre || 'Paciente sin nombre'}
                      </h3>
                      <span className={getStatusChipClassName(encounter.status)}>
                        {STATUS_LABELS[encounter.status]}
                      </span>
                      <span className={getReviewChipClassName(encounter.reviewStatus)}>
                        {REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-ink-muted">
                      {encounter.patient?.rut ? <span>{encounter.patient.rut}</span> : null}
                      <span className="flex items-center gap-1">
                        <FiCalendar className="h-3 w-3" aria-hidden="true" />
                        {format(new Date(encounter.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                      </span>
                      {encounter.createdBy?.nombre ? (
                        <span className="flex items-center gap-1">
                          <FiUser className="h-3 w-3" aria-hidden="true" />
                          {encounter.createdBy.nombre}
                        </span>
                      ) : null}
                      {encounter.progress ? (
                        <span className="flex items-center gap-1">
                          <FiList className="h-3 w-3" aria-hidden="true" />
                          {encounter.progress.completed}/{encounter.progress.total} secciones listas
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <FiChevronRight className="h-5 w-5 text-ink-muted group-hover:text-ink" aria-hidden="true" />
                </Link>
              ))}
            </div>

            {data.pagination && data.pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-surface-muted/30 p-4">
                <p className="text-body text-ink-secondary">
                  Mostrando {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, data.pagination.total)} de{' '}
                  {data.pagination.total} atenciones
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((previousPage) => Math.max(1, previousPage - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary text-sm"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((previousPage) => Math.min(data.pagination.totalPages, previousPage + 1))}
                    disabled={page === data.pagination.totalPages}
                    className="btn btn-secondary text-sm"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiFileText className="h-10 w-10 text-accent-text" aria-hidden="true" />
            </div>
            <h3 className="empty-state-title">
              {hasActiveCriteria ? 'No encontramos atenciones para este criterio' : 'No hay atenciones registradas'}
            </h3>
            <p className="empty-state-description">
              {hasActiveCriteria
                ? 'Prueba limpiando filtros o ajustando la búsqueda para recuperar resultados.'
                : 'Cuando registres la primera atención, aparecerá aquí junto con su estado clínico y progreso por secciones.'}
            </p>
            {hasAdvancedFilters ? (
              <button type="button" onClick={clearFilters} className="btn btn-secondary mb-3">
                Limpiar filtros
              </button>
            ) : null}
            {showEmptyCreateEncounterCta ? (
              <Link href="/atenciones/nueva" className="empty-state-cta">
                <FiPlus className="mr-2 h-5 w-5" aria-hidden="true" />
                Registrar primera atención
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
