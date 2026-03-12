'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Encounter, STATUS_LABELS } from '@/types';
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
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const { canCreateEncounter, canCreatePatient } = useAuthStore();
  const canCreate = canCreateEncounter();
  const canCreatePatientAllowed = canCreatePatient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['encounters', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (statusFilter) params.set('status', statusFilter);
      const response = await api.get(`/encounters?${params}`);
      return response.data;
    },
  });

  const hasData = data?.data?.length > 0;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Atenciones</h1>
          <p className="text-slate-600">Historial de atenciones médicas</p>
        </div>
        {hasData && canCreate && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/atenciones/nueva" className="btn btn-primary flex items-center gap-2">
              <FiPlus className="w-4 h-4" />
              Nueva Atención
            </Link>
            {canCreatePatientAllowed && (
              <Link href="/pacientes/nuevo" className="btn btn-secondary flex items-center gap-2">
                <FiUser className="w-4 h-4" />
                Nuevo Paciente
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Filters - only show when there's data */}
      {hasData && (
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">Filtrar por estado:</span>
            <div className="flex gap-2">
              {['', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO'].map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(1); }}
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
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          Error al cargar atenciones. Intente recargar la página.
        </div>
      )}

      {/* List */}
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
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
              >
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
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
                        'text-xs px-2 py-0.5 rounded-full',
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
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6 transition-transform hover:scale-110">
              <FiFileText className="w-10 h-10 text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No hay atenciones</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              Aún no hay atenciones registradas. Comienza creando una nueva atención para un paciente.
            </p>
            {canCreate && (
              <Link href="/atenciones/nueva" className="btn btn-primary shadow-lg shadow-primary-500/20">
                <FiPlus className="w-5 h-5 mr-2" />
                Registrar primera atencion
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
