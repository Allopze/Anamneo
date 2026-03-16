'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Encounter, REVIEW_STATUS_LABELS, STATUS_LABELS } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { FiFileText, FiCalendar, FiUser, FiChevronRight, FiChevronLeft, FiPlus } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { Suspense, useState } from 'react';

export default function AtencionesListPage() {
  return (
    <Suspense fallback={
      <div className="animate-fade-in">
        <div className="h-8 skeleton rounded w-48 mb-6" />
        <div className="card"><div className="space-y-4">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 skeleton rounded-lg" />))}</div></div>
      </div>
    }>
      <AtencionesListContent />
    </Suspense>
  );
}

function AtencionesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [reviewFilter, setReviewFilter] = useState(searchParams.get('reviewStatus') || '');
  const { canCreateEncounter, canCreatePatient } = useAuthStore();
  const canCreate = canCreateEncounter();
  const canCreatePatientAllowed = canCreatePatient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['encounters', page, statusFilter, reviewFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (statusFilter) params.set('status', statusFilter);
      if (reviewFilter) params.set('reviewStatus', reviewFilter);
      const response = await api.get(`/encounters?${params}`);
      return response.data;
    },
  });

  const hasData = data?.data?.length > 0;
  const hasActiveFilters = Boolean(statusFilter || reviewFilter);
  const showEmptyCreateEncounterCta = canCreate && !isLoading && !error && !hasData;
  const showHeaderNewEncounter = canCreate && !showEmptyCreateEncounterCta;
  const showHeaderActions = showHeaderNewEncounter || canCreatePatientAllowed;

  const clearFilters = () => {
    setStatusFilter('');
    setReviewFilter('');
    setPage(1);
    router.replace('/atenciones');
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Atenciones</h1>
          <p className="page-header-description">Historial clínico de consultas y controles registrados.</p>
        </div>
        {showHeaderActions && (
          <div className="flex flex-wrap items-center gap-2">
            {showHeaderNewEncounter && (
              <Link href="/atenciones/nueva" className="btn btn-primary flex items-center gap-2">
                <FiPlus className="w-4 h-4" />
                Nueva Atención
              </Link>
            )}
            {canCreatePatientAllowed && (
              <Link href="/pacientes/nuevo" className="btn btn-secondary flex items-center gap-2">
                <FiUser className="w-4 h-4" />
                Nuevo Paciente
              </Link>
            )}
          </div>
        )}
      </div>

      {(hasData || hasActiveFilters) && (
        <div className="filter-surface">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="text-sm text-slate-600">Filtrar por estado:</span>
                  <div className="flex flex-wrap gap-2">
                    {['', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setPage(1);
                          const params = new URLSearchParams(searchParams.toString());
                          if (status) params.set('status', status); else params.delete('status');
                          router.replace(`/atenciones${params.toString() ? `?${params.toString()}` : ''}`);
                        }}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-sm transition-colors',
                          statusFilter === status
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {status === '' ? 'Todos' : STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="text-sm text-slate-600">Revisión:</span>
                  <div className="flex flex-wrap gap-2">
                    {['', 'LISTA_PARA_REVISION', 'REVISADA_POR_MEDICO'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setReviewFilter(status);
                          setPage(1);
                          const params = new URLSearchParams(searchParams.toString());
                          if (status) params.set('reviewStatus', status); else params.delete('reviewStatus');
                          router.replace(`/atenciones${params.toString() ? `?${params.toString()}` : ''}`);
                        }}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-sm transition-colors',
                          reviewFilter === status
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {status === '' ? 'Todas' : REVIEW_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="card mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          Error al cargar atenciones. Intente recargar la página.
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 skeleton rounded-full" />
                <div className="flex-1">
                  <div className="h-4 skeleton rounded w-1/2 mb-2" />
                  <div className="h-3 skeleton rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : hasData ? (
          <div className="divide-y divide-slate-100">
            {data.data.map((encounter: Encounter) => (
              <Link
                key={encounter.id}
                href={`/atenciones/${encounter.id}`}
                className="group list-row"
              >
                <div
                  className={clsx(
                    'list-row-icon',
                    encounter.status === 'COMPLETADO'
                      ? 'bg-clinical-100 text-clinical-600'
                      : encounter.status === 'EN_PROGRESO'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  <FiFileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900 group-hover:text-primary-600">
                      {encounter.patient?.nombre || 'Paciente'}
                    </span>
                    <span
                      className={clsx(
                        'list-chip',
                        encounter.status === 'COMPLETADO'
                          ? 'bg-clinical-100 text-clinical-700'
                          : encounter.status === 'EN_PROGRESO'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {STATUS_LABELS[encounter.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <FiCalendar className="w-3 h-3" />
                      {format(new Date(encounter.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiUser className="w-3 h-3" />
                      {encounter.createdBy?.nombre}
                    </span>
                    {encounter.reviewStatus && (
                      <span>{REVIEW_STATUS_LABELS[encounter.reviewStatus]}</span>
                    )}
                    {encounter.progress && (
                      <span>
                        {encounter.progress.completed}/{encounter.progress.total} secciones
                      </span>
                    )}
                  </div>
                </div>
                <FiChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiFileText className="w-10 h-10 text-primary-400" />
            </div>
            <h3 className="empty-state-title">
              {hasActiveFilters ? 'No hay resultados para estos filtros' : 'No hay atenciones'}
            </h3>
            <p className="empty-state-description">
              {hasActiveFilters
                ? 'Prueba ajustando o limpiando los filtros para volver a ver atenciones.'
                : 'Aún no hay atenciones registradas. Comienza creando una nueva atención para un paciente.'}
            </p>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="btn btn-secondary mb-3">
                Limpiar filtros
              </button>
            )}
            {showEmptyCreateEncounterCta && (
              <Link href="/atenciones/nueva" className="empty-state-cta">
                <FiPlus className="w-5 h-5 mr-2" />
                Registrar primera atención
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-600">
            Página {data.pagination.page} de {data.pagination.totalPages} ({data.pagination.total} atenciones)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-50"
            >
              <FiChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page >= data.pagination.totalPages}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-50"
            >
              Siguiente
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
