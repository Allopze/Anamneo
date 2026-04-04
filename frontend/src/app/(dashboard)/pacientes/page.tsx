'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Patient, SEXO_LABELS, PREVISION_LABELS } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { FiPlus, FiSearch, FiUser, FiChevronRight, FiCalendar, FiFileText, FiFilter, FiDownload, FiChevronDown } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const SEXO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMENINO', label: 'Femenino' },
  { value: 'OTRO', label: 'Otro' },
  { value: 'PREFIERE_NO_DECIR', label: 'Prefiere no decir' },
];

const PREVISION_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'FONASA', label: 'Fonasa' },
  { value: 'ISAPRE', label: 'Isapre' },
  { value: 'OTRA', label: 'Otra' },
  { value: 'DESCONOCIDA', label: 'Desconocida' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Fecha de registro' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'edad', label: 'Edad' },
  { value: 'updatedAt', label: 'Última actualización' },
];

export default function PacientesPage() {
  return (
    <Suspense fallback={
      <div className="animate-fade-in">
        <div className="h-8 skeleton rounded w-48 mb-6" />
        <div className="card"><div className="space-y-4">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 skeleton rounded-lg" />))}</div></div>
      </div>
    }>
      <PacientesContent />
    </Suspense>
  );
}

function PacientesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canCreatePatient, canCreateEncounter, user } = useAuthStore();
  const canCreate = canCreatePatient();
  const canCreateEncounterAllowed = canCreateEncounter();
  const search = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(search);
  const page = Number(searchParams.get('page') || '1');
  const [showFilters, setShowFilters] = useState(false);

  // Read filters from URL searchParams
  const filters = {
    sexo: searchParams.get('sexo') || '',
    prevision: searchParams.get('prevision') || '',
    edadMin: searchParams.get('edadMin') || '',
    edadMax: searchParams.get('edadMax') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  };

  const buildUrl = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { search, ...filters, page: String(page), ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v && v !== '' && !(k === 'page' && v === '1') && !(k === 'sortBy' && v === 'createdAt') && !(k === 'sortOrder' && v === 'desc')) next.set(k, v); });
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
    router.push(buildUrl({ sexo: '', prevision: '', edadMin: '', edadMax: '', sortBy: 'createdAt', sortOrder: 'desc', page: '1' }));
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', search, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('limit', '10');
      if (filters.sexo) params.set('sexo', filters.sexo);
      if (filters.prevision) params.set('prevision', filters.prevision);
      if (filters.edadMin) params.set('edadMin', filters.edadMin);
      if (filters.edadMax) params.set('edadMax', filters.edadMax);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      const response = await api.get(`/patients?${params}`);
      return response.data;
    },
  });

  const hasPatients = data?.data?.length > 0;
  const showEmptyCreatePatientCta = canCreate && !search && !isLoading && !error && !hasPatients;
  const showHeaderNewPatient = canCreate && !showEmptyCreatePatientCta;
  const showHeaderActions = showHeaderNewPatient || canCreateEncounterAllowed;

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

      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-body text-ink-secondary hover:text-ink font-medium mb-2"
        >
          <FiFilter className="w-4 h-4" />
          Filtros avanzados
          <FiChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="filter-surface">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-micro text-ink-muted mb-1">Sexo</label>
                <select
                  className="input w-full text-sm"
                  value={filters.sexo}
                  onChange={(e) => setFilter('sexo', e.target.value)}
                >
                  {SEXO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-micro text-ink-muted mb-1">Previsión</label>
                <select
                  className="input w-full text-sm"
                  value={filters.prevision}
                  onChange={(e) => setFilter('prevision', e.target.value)}
                >
                  {PREVISION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-micro text-ink-muted mb-1">Edad mín</label>
                <input
                  type="number"
                  className="input w-full text-sm"
                  value={filters.edadMin}
                  onChange={(e) => setFilter('edadMin', e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-micro text-ink-muted mb-1">Edad máx</label>
                <input
                  type="number"
                  className="input w-full text-sm"
                  value={filters.edadMax}
                  onChange={(e) => setFilter('edadMax', e.target.value)}
                  placeholder="120"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-micro text-ink-muted mb-1">Ordenar</label>
                <select
                  className="input w-full text-sm"
                  value={filters.sortBy}
                  onChange={(e) => setFilter('sortBy', e.target.value)}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-micro text-ink-muted mb-1">Orden</label>
                <select
                  className="input w-full text-sm"
                  value={filters.sortOrder}
                  onChange={(e) => setFilter('sortOrder', e.target.value)}
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                className="text-micro text-ink-secondary hover:text-ink hover:underline"
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
              {user?.isAdmin && (
                <button
                  className="flex items-center gap-1 text-micro text-ink-secondary hover:text-ink"
                  onClick={async () => {
                    try {
                      const res = await api.get('/patients/export/csv', { responseType: 'blob' });
                      const url = URL.createObjectURL(new Blob([res.data]));
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `pacientes_${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('CSV descargado');
                    } catch { toast.error('Error al exportar'); }
                  }}
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="card mb-6 p-4 bg-status-red/10 text-status-red-text text-body rounded-card">
          Error al cargar pacientes. Intente recargar la página.
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
              {data.data.map((patient: Patient) => {
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
                          {patient.edad} años
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-body text-ink-muted">
                        {patient.rut && <span>{patient.rut}</span>}
                        <span>{SEXO_LABELS[patient.sexo]}</span>
                        <span>{PREVISION_LABELS[patient.prevision]}</span>
                        {patient._count && (
                          <span className="flex items-center gap-1">
                            <FiCalendar className="w-3 h-3" />
                            {patient._count.encounters} atenciones
                          </span>
                        )}
                      </div>
                    </div>
                    <FiChevronRight className="w-5 h-5 text-ink-muted group-hover:text-ink" />
                  </>
                );

                return (
                  <Link key={patient.id} href={patientHref} className="group list-row">
                    {rowContent}
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {data.pagination && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-surface-muted/30">
                <p className="text-body text-ink-secondary">
                  Mostrando {(page - 1) * 10 + 1} - {Math.min(page * 10, data.pagination.total)} de{' '}
                  {data.pagination.total} pacientes
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
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
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
              {search ? 'No se encontraron pacientes que coincidan con tu búsqueda.' : 'Aún no has registrado ningún paciente. Comienza agregando uno para gestionar su historial médico.'}
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
