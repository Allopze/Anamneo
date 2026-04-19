'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { Patient, PATIENT_COMPLETENESS_STATUS_LABELS, PatientCompletenessStatus } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import {
  FiPlus,
  FiSearch,
  FiUser,
  FiChevronRight,
  FiCalendar,
  FiFileText,
} from 'react-icons/fi';
import { formatPatientAge, formatPatientPrevision, formatPatientSex, getPatientCompletenessMeta } from '@/lib/patient';
import { COMPLETENESS_OPTIONS, TASK_WINDOW_OPTIONS, type PatientFilters } from './pacientes.constants';
import PatientsFilterPanel from './PatientsFilterPanel';

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
  const { canCreatePatient, canCreateEncounter, isMedico, user } = useAuthStore();
  const canCreate = canCreatePatient();
  const canCreateEncounterAllowed = canCreateEncounter();
  const canRestoreArchived = isMedico();
  const search = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(search);
  const page = Number(searchParams.get('page') || '1');

  // Read filters from URL searchParams
  const filters: PatientFilters = {
    archived: searchParams.get('archived') || '',
    sexo: searchParams.get('sexo') || '',
    prevision: searchParams.get('prevision') || '',
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
      if (
        v &&
        v !== '' &&
        !(k === 'page' && v === '1') &&
        !(k === 'sortBy' && v === 'createdAt') &&
        !(k === 'sortOrder' && v === 'desc')
      )
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
    router.push(
      buildUrl({
        archived: '',
        sexo: '',
        prevision: '',
        completenessStatus: '',
        taskWindow: '',
        edadMin: '',
        edadMax: '',
        clinicalSearch: '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: '1',
      }),
    );
  };

  const { data, isLoading, error } = useQuery<PatientsResponse>({
    queryKey: ['patients', search, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('limit', '10');
      if (filters.sexo) params.set('sexo', filters.sexo);
      if (filters.prevision) params.set('prevision', filters.prevision);
      if (filters.archived) params.set('archived', filters.archived);
      if (filters.completenessStatus) params.set('completenessStatus', filters.completenessStatus);
      if (filters.taskWindow) params.set('taskWindow', filters.taskWindow);
      if (filters.edadMin) params.set('edadMin', filters.edadMin);
      if (filters.edadMax) params.set('edadMax', filters.edadMax);
      if (filters.clinicalSearch) params.set('clinicalSearch', filters.clinicalSearch);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      const response = await api.get(`/patients?${params}`);
      return response.data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (patientId: string) => api.post(`/patients/${patientId}/restore`, {}),
    onSuccess: async (response) => {
      const restoredEncounterCount = Number((response.data as { restoredEncounterCount?: number })?.restoredEncounterCount ?? 0);
      toast.success(
        restoredEncounterCount > 0
          ? `Paciente restaurado. Se reabrieron ${restoredEncounterCount} atenciones.`
          : 'Paciente restaurado',
      );
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const patients = data?.data ?? [];
  const pagination = data?.pagination;
  const hasPatients = patients.length > 0;
  const showEmptyCreatePatientCta = canCreate && !search && !isLoading && !error && !hasPatients;
  const showHeaderNewPatient = canCreate && !showEmptyCreatePatientCta;
  const showHeaderActions = showHeaderNewPatient || canCreateEncounterAllowed;
  const activeCompletenessStatus = COMPLETENESS_OPTIONS.some((option) => option.value === filters.completenessStatus)
    ? (filters.completenessStatus as PatientCompletenessStatus)
    : undefined;
  const activeTaskWindowLabel = TASK_WINDOW_OPTIONS.find((option) => option.value === filters.taskWindow)?.label;
  const completenessSummaryCards = data
    ? [
        {
          status: 'INCOMPLETA' as const,
          label: 'Fichas incompletas',
          value: data.summary.incomplete,
          description: 'Aún faltan datos mínimos de registro.',
        },
        {
          status: 'PENDIENTE_VERIFICACION' as const,
          label: 'Pendientes de validación',
          value: data.summary.pendingVerification,
          description: 'Recepción completó datos, falta validación médica.',
        },
        {
          status: 'VERIFICADA' as const,
          label: 'Verificadas',
          value: data.summary.verified,
          description: 'Listas para continuidad clínica sin bloqueo.',
        },
      ]
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    router.push(buildUrl({ search: trimmed, page: '1' }));
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
          <div className="grid gap-3 md:grid-cols-3">
            {completenessSummaryCards.map((card) => {
              const isActive = filters.completenessStatus === card.status;

              return (
                <button
                  key={card.status}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilter('completenessStatus', isActive ? '' : card.status)}
                  className={clsx(
                    'rounded-card border px-4 py-4 text-left transition-colors',
                    isActive
                      ? 'border-accent/50 bg-accent/12 shadow-soft'
                      : 'border-surface-muted/30 bg-surface-elevated hover:bg-surface-inset/40',
                  )}
                >
                  <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">{card.label}</p>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{card.value}</p>
                  <p className="mt-2 text-sm text-ink-secondary">{card.description}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-ink-secondary">
            Universo visible: {data.summary.totalPatients} fichas. No verificadas: {data.summary.nonVerified}.
            {filters.archived === 'ARCHIVED' ? ' Mostrando solo fichas archivadas.' : ''}
            {filters.archived === 'ALL' ? ' Mostrando activas y archivadas.' : ''}
            {activeCompletenessStatus
              ? ` Mostrando ${data.pagination.total} registros dentro del filtro ${PATIENT_COMPLETENESS_STATUS_LABELS[activeCompletenessStatus].toLowerCase()}.`
              : ''}
            {filters.taskWindow && activeTaskWindowLabel
              ? ` Filtro operativo activo: ${activeTaskWindowLabel.toLowerCase()}.`
              : ''}
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

      <PatientsFilterPanel
        filters={filters}
        isAdmin={!!user?.isAdmin}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
      />

      {error && (
        <div className="card mb-6 p-4 bg-status-red/10 text-status-red-text text-body rounded-card">
          Error al cargar pacientes. Intente recargar la página.
        </div>
      )}

      {pagination?.clinicalSearchCapped && (
        <div className="card mb-4 border-status-yellow/35 bg-status-yellow/10 p-4 text-sm text-accent-text">
          La búsqueda clínica se acotó a los primeros 500 pacientes visibles. Si falta un resultado, reduce filtros o
          busca por nombre o RUT.
        </div>
      )}

      <div className="card transition-all duration-300">
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
              {patients.map((patient: Patient) => {
                const completenessMeta = getPatientCompletenessMeta(patient);
                const isArchived = Boolean(patient.archivedAt);
                const patientHref = user?.isAdmin
                  ? `/pacientes/${patient.id}/administrativo`
                  : `/pacientes/${patient.id}`;
                const rowContent = (
                  <>
                    <div className="list-row-icon h-12 w-12 bg-surface-inset text-ink-secondary">
                      <FiUser className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-ink truncate group-hover:text-ink-secondary">
                          {patient.nombre}
                        </h3>
                        <span className="list-chip bg-surface-inset text-ink-secondary">
                          {formatPatientAge(patient.edad, patient.edadMeses)}
                        </span>
                        {isArchived ? (
                          <span className="list-chip bg-status-red/10 text-status-red-text">Archivado</span>
                        ) : null}
                        <span className={`list-chip ${completenessMeta.badgeClassName}`}>{completenessMeta.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-body text-ink-muted">
                        <span>{patient.rut || 'Sin RUT'}</span>
                        <span>{formatPatientSex(patient.sexo)}</span>
                        <span>{formatPatientPrevision(patient.prevision)}</span>
                        {patient._count && (
                          <span className="flex items-center gap-1">
                            <FiCalendar className="w-3 h-3" />
                            {patient._count.encounters} atenciones
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );

                if (isArchived) {
                  return (
                    <div key={patient.id} className="list-row">
                      {rowContent}
                      {canRestoreArchived ? (
                        <button
                          type="button"
                          className="btn btn-secondary text-sm"
                          onClick={() => restoreMutation.mutate(patient.id)}
                          disabled={restoreMutation.isPending}
                        >
                          Restaurar
                        </button>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <Link key={patient.id} href={patientHref} className="group list-row">
                    {rowContent}
                    <FiChevronRight className="w-5 h-5 text-ink-muted group-hover:text-ink" />
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-surface-muted/30">
                <p className="text-body text-ink-secondary">
                  Mostrando {(page - 1) * 10 + 1} - {Math.min(page * 10, pagination.total)} de {pagination.total}{' '}
                  pacientes
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary text-sm"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="btn btn-secondary text-sm"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiUser className="w-10 h-10 text-ink-muted" />
            </div>
            <h3 className="empty-state-title">No hay pacientes</h3>
            <p className="empty-state-description">
              {search
                ? 'No se encontraron pacientes que coincidan con tu búsqueda.'
                : filters.archived === 'ARCHIVED'
                  ? 'No hay pacientes archivados dentro de tu alcance visible.'
                  : 'Aún no has registrado ningún paciente. Comienza agregando uno para gestionar su historial médico.'}
            </p>
            {showEmptyCreatePatientCta && (
              <Link href="/pacientes/nuevo" className="empty-state-cta">
                <FiPlus className="w-5 h-5 mr-2" />
                Registrar primer paciente
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
