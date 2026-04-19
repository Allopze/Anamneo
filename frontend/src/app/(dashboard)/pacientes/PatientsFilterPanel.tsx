'use client';

import { useState } from 'react';
import { FiFilter, FiChevronDown, FiDownload } from 'react-icons/fi';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { todayLocalDateString } from '@/lib/date';
import {
  ARCHIVED_OPTIONS,
  SEXO_OPTIONS,
  PREVISION_OPTIONS,
  COMPLETENESS_OPTIONS,
  SORT_OPTIONS,
  TASK_WINDOW_OPTIONS,
  type PatientFilters,
} from './pacientes.constants';

interface PatientsFilterPanelProps {
  filters: PatientFilters;
  isAdmin: boolean;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

export default function PatientsFilterPanel({
  filters,
  isAdmin,
  onFilterChange,
  onClearFilters,
}: PatientsFilterPanelProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <div>
              <label className="block text-micro text-ink-muted mb-1">Estado</label>
              <select
                className="input w-full text-sm"
                value={filters.archived}
                onChange={(e) => onFilterChange('archived', e.target.value)}
              >
                {ARCHIVED_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-micro text-ink-muted mb-1">Sexo</label>
              <select
                className="input w-full text-sm"
                value={filters.sexo}
                onChange={(e) => onFilterChange('sexo', e.target.value)}
              >
                {SEXO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-micro text-ink-muted mb-1">Previsión</label>
              <select
                className="input w-full text-sm"
                value={filters.prevision}
                onChange={(e) => onFilterChange('prevision', e.target.value)}
              >
                {PREVISION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-micro text-ink-muted mb-1">Completitud</label>
              <select
                className="input w-full text-sm"
                value={filters.completenessStatus}
                onChange={(e) => onFilterChange('completenessStatus', e.target.value)}
              >
                {COMPLETENESS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="patient-task-window" className="block text-micro text-ink-muted mb-1">Seguimientos</label>
              <select
                id="patient-task-window"
                className="input w-full text-sm"
                value={filters.taskWindow}
                onChange={(e) => onFilterChange('taskWindow', e.target.value)}
              >
                {TASK_WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-micro text-ink-muted mb-1">Edad mín</label>
              <input
                type="number"
                className="input w-full text-sm"
                value={filters.edadMin}
                onChange={(e) => onFilterChange('edadMin', e.target.value)}
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
                onChange={(e) => onFilterChange('edadMax', e.target.value)}
                placeholder="120"
                min={0}
              />
            </div>
            <div className="col-span-2 md:col-span-2 lg:col-span-2">
              <label className="block text-micro text-ink-muted mb-1">Motivo o síntoma</label>
              <input
                type="text"
                className="input w-full text-sm"
                value={filters.clinicalSearch}
                onChange={(e) => onFilterChange('clinicalSearch', e.target.value)}
                placeholder="Ej: cefalea, tos, dolor abdominal..."
              />
            </div>
            <div>
              <label className="block text-micro text-ink-muted mb-1">Ordenar</label>
              <select
                className="input w-full text-sm"
                value={filters.sortBy}
                onChange={(e) => onFilterChange('sortBy', e.target.value)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-micro text-ink-muted mb-1">Orden</label>
              <select
                className="input w-full text-sm"
                value={filters.sortOrder}
                onChange={(e) => onFilterChange('sortOrder', e.target.value)}
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              className="text-micro text-ink-secondary hover:text-ink hover:underline"
              onClick={onClearFilters}
            >
              Limpiar filtros
            </button>
            {isAdmin && (
              <button
                type="button"
                className="flex items-center gap-1 text-micro text-ink-secondary hover:text-ink"
                onClick={async () => {
                  try {
                    const res = await api.get('/patients/export/csv', { responseType: 'blob' });
                    const url = URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pacientes_${todayLocalDateString()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('CSV descargado');
                  } catch {
                    toast.error('Error al exportar');
                  }
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
  );
}
