'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { notify } from '@/lib/notify';
import type { Patient, PatientCompletenessStatus } from '@/types';
import { PATIENT_COMPLETENESS_STATUS_LABELS } from '@/types';
import {
  useAuthCanCreateEncounter,
  useAuthCanCreatePatient,
  useAuthIsMedico,
  useAuthUser,
} from '@/stores/auth-store';
import { FiFileText, FiPlus, FiSearch, FiUser } from 'react-icons/fi';
import { COMPLETENESS_OPTIONS, TASK_WINDOW_OPTIONS, type PatientFilters } from './pacientes.constants';
import PatientsFilterPanel from './PatientsFilterPanel';
import {
  NewPatientEmptyStateCta,
  PatientCompletenessSummary,
  PatientListRow,
} from './pacientes.parts';

interface PatientsResponse {
  data: Patient[];
  summary: {
    totalPatients: number;
    incomplete: number;
    pendingVerification: number;
    verified: number;
    nonVerified: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    clinicalSearchCapped?: boolean;
  };
}

export default function PacientesPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-fade-in">
          <div className="h-8 skeleton rounded w-48 mb-6" />
          <div className="card">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 skeleton rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <PacientesContent />
    </Suspense>
  );
}

function PacientesContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const canCreate = useAuthCanCreatePatient();
  const canCreateEncounterAllowed = useAuthCanCreateEncounter();
  const canRestoreArchived = useAuthIsMedico();
  const search = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(search);
  const page = Number(searchParams.get('page') || '1');

  const filters: PatientFilters = {
    archived: searchParams.get('archived') || '',
    sexo: searchParams.get('sexo') || '',
    prevision: searchParams.get('prevision') || '',
    rutExempt: searchParams.get('rutExempt') || '',
    completenessStatus: searchParams.get('completenessStatus') || '',
    taskWindow: searchParams.get('taskWindow') || '',
    edadMin: searchParams.get('edadMin') || '',
    edadMax: searchParams.get('edadMax') || '',
    clinicalSearch: searchParams.get('clinicalSearch') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  };

  const buildUrl = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { search, ...filters, page: String(page), ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v && v !== '' && !(k === 'page' && v === '1') && !(k === 'sortBy' && v === 'createdAt') && !(k === 'sortOrder' && v === 'desc'))
        next.set(k, v);
    });
    const qs = next.toString();
    return `/pacientes${qs ? `?${qs}` : ''}`;
  };

  const setPage = (p: number | ((prev: number) => number)) => {
    const nextPage = typeof p === 'function' ? p(page) : p;
    router.push(buildUrl({ page: String(nextPage) }));
  };

  const setFilter = (key: string, value: string) => {
    router.push(buildUrl({ [key]: value, page: '1' }));
  };

  const clearFilters = () => {
    router.push(buildUrl({ archived: '', sexo: '', prevision: '', rutExempt: '', completenessStatus: '', taskWindow: '', edadMin: '', edadMax: '', clinicalSearch: '', sortBy: 'createdAt', sortOrder: 'desc', page: '1' }));
  };

  const { data, isLoading, isFetching, error } = useQuery<PatientsResponse>({
    queryKey: ['patients', search, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('limit', '10');
      Object.entries(filters).forEach(([k, v]) => {
        if (v && k !== 'sortBy' && k !== 'sortOrder') params.set(k, v);
      });
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      const response = await api.get(`/patients?${params}`);
      return response.data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (patientId: string) => api.post(`/patients/${patientId}/restore`, {}),
    onSuccess: async (response) => {
      const count = Number((response.data as { restoredEncounterCount?: number })?.restoredEncounterCount ?? 0);
      notify.success(count > 0 ? `Paciente restaurado. Se reabrieron ${count} atenciones.` : 'Paciente restaurado');
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const patients = data?.data ?? [];
  const pagination = data?.pagination;
  const hasPatients = patients.length > 0;
  const showEmptyCreatePatientCta = canCreate && !search && !isLoading && !error && !hasPatients;
  const showHeaderNewPatient = canCreate && !showEmptyCreatePatientCta;
  const showHeaderActions = showHeaderNewPatient || canCreateEncounterAllowed;
  const activeCompletenessStatus = COMPLETENESS_OPTIONS.some((o) => o.value === filters.completenessStatus)
    ? (filters.completenessStatus as PatientCompletenessStatus)
    : undefined;
  const activeTaskWindowLabel = TASK_WINDOW_OPTIONS.find((o) => o.value === filters.taskWindow)?.label;
  const completenessSummaryCards = data
    ? [
        { status: 'INCOMPLETA' as const, label: 'Fichas incompletas', value: data.summary.incomplete, description: 'Aún faltan datos mínimos de registro.' },
        { status: 'PENDIENTE_VERIFICACION' as const, label: 'Pendientes de validación', value: data.summary.pendingVerification, description: 'Recepción completó datos, falta validación médica.' },
        { status: 'VERIFICADA' as const, label: 'Verificadas', value: data.summary.verified, description: 'Listas para continuidad clínica sin bloqueo.' },
      ]
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput.trim(), page: '1' }));
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Pacientes</h1>
          <p className="page-header-description">
            {user?.isAdmin
              ? 'Consulta el registro administrativo de pacientes y exporta el padrón actual.'
              : 'Gestiona el registro longitudinal de pacientes.'}
          </p>
        </div>
        {showHeaderActions && (
          <div className="flex flex-wrap items-center gap-2">
            {showHeaderNewPatient && (
              <Link href="/pacientes/nuevo" className="btn btn-primary flex items-center gap-2">
                <FiPlus className="w-4 h-4" />
                Nuevo Paciente
              </Link>
            )}
            {canCreateEncounterAllowed && (
              <Link href="/atenciones/nueva" className="btn btn-secondary flex items-center gap-2">
                <FiFileText className="w-4 h-4" />
                Nueva Atención
              </Link>
            )}
          </div>
        )}
      </div>

      {!isLoading && data?.summary ? (
        <section className="mb-5">
          <PatientCompletenessSummary
            cards={completenessSummaryCards}
            activeFilter={activeCompletenessStatus}
            onFilterChange={setFilter}
          />
          <p className="mt-3 text-sm text-ink-secondary">
            {[
              `Universo visible: ${data.summary.totalPatients} fichas. No verificadas: ${data.summary.nonVerified}.`,
              filters.archived === 'ARCHIVED' ? ' Mostrando solo fichas archivadas.' : '',
              filters.archived === 'ALL' ? ' Mostrando activas y archivadas.' : '',
              activeCompletenessStatus
                ? ` Mostrando ${pagination?.total ?? 0} registros dentro del filtro ${PATIENT_COMPLETENESS_STATUS_LABELS[activeCompletenessStatus].toLowerCase()}.`
                : '',
              filters.taskWindow && activeTaskWindowLabel
                ? ` Filtro operativo activo: ${activeTaskWindowLabel.toLowerCase()}.`
                : '',
            ].join('')}
          </p>
        </section>
      ) : null}

      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre o RUT…"
            className="form-input pl-11 w-full"
          />
        </div>
      </form>

      <PatientsFilterPanel filters={filters} isAdmin={!!user?.isAdmin} onFilterChange={setFilter} onClearFilters={clearFilters} />

      {error && (
        <div className="mb-6">
          <ErrorAlert message={getErrorMessage(error)} title="No se pudieron cargar los pacientes" />
        </div>
      )}

      {pagination?.clinicalSearchCapped && (
        <div className="card mb-4 border-status-yellow/35 bg-status-yellow/10 p-4 text-sm text-accent-text">
          La búsqueda clínica se acotó a los primeros 500 pacientes visibles. Si falta un resultado, reduce filtros o busca por nombre o RUT.
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-surface-muted/20">
                <div className="w-12 h-12 skeleton rounded-icon" />
                <div className="flex-1">
                  <div className="h-4 skeleton w-1/3 mb-2" />
                  <div className="h-3 skeleton w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : hasPatients ? (
          <>
            <div className="divide-y divide-surface-muted/30">
              {patients.map((patient: Patient) => (
                <PatientListRow
                  key={patient.id}
                  patient={patient}
                  isAdmin={!!user?.isAdmin}
                  canRestoreArchived={canRestoreArchived}
                  isRestoring={restoreMutation.isPending}
                  onRestore={(id) => restoreMutation.mutate(id)}
                />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-surface-muted/30">
                <p className="text-body text-ink-secondary">
                  Mostrando {(page - 1) * 10 + 1} - {Math.min(page * 10, pagination.total)} de{' '}
                  {pagination.total} pacientes
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isFetching} className="btn btn-secondary text-sm">
                    Anterior
                  </button>
                  <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages || isFetching} className="btn btn-secondary text-sm">
                    {isFetching ? 'Cargando…' : 'Siguiente'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<FiUser className="h-6 w-6" aria-hidden="true" />}
            title={search || filters.archived === 'ARCHIVED' ? 'Sin pacientes para este criterio' : 'Sin pacientes registrados'}
            description={
              search
                ? 'No encontramos pacientes que coincidan con tu búsqueda. Ajusta el texto o limpia los filtros para ampliar la lista.'
                : filters.archived === 'ARCHIVED'
                  ? 'No hay pacientes archivados dentro de tu alcance visible.'
                  : 'Cuando registres el primer paciente, aparecerá aquí con su estado de ficha y continuidad clínica.'
            }
            action={showEmptyCreatePatientCta ? <NewPatientEmptyStateCta /> : undefined}
          />
        )}
      </div>
    </div>
  );
}
