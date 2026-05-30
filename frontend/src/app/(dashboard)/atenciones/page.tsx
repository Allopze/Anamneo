'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FiPlus, FiSearch, FiUser } from 'react-icons/fi';
import { FichaIcon } from '@/components/icons';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { DASHBOARD_STATS_QUERY_KEY, fetchDashboardStats } from '@/lib/dashboard-stats';
import type { Encounter } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import {
  canCreateEncounter as canCreateEncounterPermission,
  canCreatePatient as canCreatePatientPermission,
} from '@/lib/permissions';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { PAGE_SIZE, type OperationalDashboardData } from './atenciones.constants';
import {
  EncounterFilterPanel,
  EncounterKpiCards,
  EncounterListRow,
} from './atenciones.parts';

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
  const user = useAuthStore((state) => state.user);
  const isOperationalAdmin = !!user?.isAdmin;
  const canCreate = canCreateEncounterPermission(user);
  const canCreatePatientAllowed = canCreatePatientPermission(user);
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
    if (hasAdvancedFilters) setShowFilters(true);
  }, [hasAdvancedFilters]);

  const buildUrl = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { search, status: filters.status, reviewStatus: filters.reviewStatus, page: String(page), ...overrides };
    Object.entries(merged).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'page' && value === '1') return;
      next.set(key, value);
    });
    const queryString = next.toString();
    return `/atenciones${queryString ? `?${queryString}` : ''}`;
  };

  const setPage = (nextPage: number | ((prev: number) => number)) => {
    const resolved = typeof nextPage === 'function' ? nextPage(page) : nextPage;
    router.push(buildUrl({ page: String(resolved) }));
  };

  const setFilter = (key: 'status' | 'reviewStatus', value: string) => {
    router.push(buildUrl({ [key]: value, page: '1' }));
  };

  const clearFilters = () => router.push(buildUrl({ status: '', reviewStatus: '', page: '1' }));

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
    queryKey: DASHBOARD_STATS_QUERY_KEY,
    queryFn: fetchDashboardStats<OperationalDashboardData>,
    enabled: !isOperationalAdmin,
    staleTime: 60_000,
  });

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

      {operationalData ? <EncounterKpiCards data={operationalData} /> : null}

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

      <EncounterFilterPanel
        showFilters={showFilters}
        filters={filters}
        hasAdvancedFilters={hasAdvancedFilters}
        onToggle={() => setShowFilters((c) => !c)}
        onSetFilter={setFilter}
        onClearFilters={clearFilters}
      />

      {error ? (
        <div className="mb-6">
          <ErrorAlert
            title="No se pudieron cargar las atenciones"
            message="Revisa tu conexión o intenta recargar la página."
          />
        </div>
      ) : null}

      <div className="card">
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
                <EncounterListRow key={encounter.id} encounter={encounter} />
              ))}
            </div>

            {data.pagination && data.pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-surface-muted/30 p-4">
                <p className="text-body text-ink-secondary">
                  Mostrando {(page - 1) * PAGE_SIZE + 1} -{' '}
                  {Math.min(page * PAGE_SIZE, data.pagination.total)} de {data.pagination.total} atenciones
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary text-sm"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
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
          <EmptyState
            icon={<FichaIcon className="h-6 w-6" />}
            title={hasActiveCriteria ? 'Sin atenciones para este criterio' : 'Sin atenciones registradas'}
            description={
              hasActiveCriteria
                ? 'Prueba limpiando filtros o ajustando la búsqueda para recuperar resultados.'
                : 'Cuando registres la primera atención, aparecerá aquí junto con su estado clínico y progreso por secciones.'
            }
            action={
              hasAdvancedFilters || showEmptyCreateEncounterCta ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {hasAdvancedFilters ? (
                    <button type="button" onClick={clearFilters} className="btn btn-secondary">
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
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
