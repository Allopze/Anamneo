'use client';

/**
 * Sub-components used by atenciones/page.tsx.
 */

import Link from 'next/link';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiCalendar, FiChevronDown, FiFilter, FiList, FiUser } from 'react-icons/fi';
import { FichaIcon } from '@/components/icons';
import type { Encounter } from '@/types';
import { REVIEW_STATUS_LABELS, STATUS_LABELS } from '@/types';
import {
  REVIEW_OPTIONS,
  STATUS_OPTIONS,
  getReviewChipClassName,
  getStatusChipClassName,
  type OperationalDashboardData,
} from './atenciones.constants';

// ── KPI cards ────────────────────────────────────────────────────

export function EncounterKpiCards({ data }: { data: OperationalDashboardData }) {
  return (
    <section className="mb-5 grid gap-3 md:grid-cols-3">
      <Link
        href="/atenciones?status=EN_PROGRESO"
        className="rounded-card bg-surface-elevated px-4 py-4 shadow-soft transition-colors hover:bg-surface-inset/40"
      >
        <p className="text-sm font-bold text-ink-muted">En curso</p>
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{data.counts.enProgreso}</p>
        <p className="mt-2 text-sm text-ink-secondary">Atenciones abiertas dentro del circuito activo.</p>
      </Link>
      <Link
        href="/atenciones?reviewStatus=LISTA_PARA_REVISION"
        className="rounded-card bg-surface-elevated px-4 py-4 shadow-soft transition-colors hover:bg-surface-inset/40"
      >
        <p className="text-sm font-bold text-ink-muted">Pendientes de revisión</p>
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{data.counts.pendingReview}</p>
        <p className="mt-2 text-sm text-ink-secondary">Casos listos para revisión o cierre médico.</p>
      </Link>
      <Link
        href="/pacientes?completenessStatus=PENDIENTE_VERIFICACION"
        className="rounded-card bg-surface-elevated px-4 py-4 shadow-soft transition-colors hover:bg-surface-inset/40"
      >
        <p className="text-sm font-bold text-ink-muted">Fichas por validar</p>
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{data.counts.patientPendingVerification}</p>
        <p className="mt-2 text-sm text-ink-secondary">Recepción completó datos y espera validación médica.</p>
      </Link>
    </section>
  );
}

// ── Filter panel ─────────────────────────────────────────────────

interface FilterPanelProps {
  showFilters: boolean;
  filters: { status: string; reviewStatus: string };
  hasAdvancedFilters: boolean;
  onToggle: () => void;
  onSetFilter: (key: 'status' | 'reviewStatus', value: string) => void;
  onClearFilters: () => void;
}

export function EncounterFilterPanel({
  showFilters,
  filters,
  hasAdvancedFilters,
  onToggle,
  onSetFilter,
  onClearFilters,
}: FilterPanelProps) {
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={onToggle}
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
                onChange={(event) => onSetFilter('status', event.target.value)}
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
                onChange={(event) => onSetFilter('reviewStatus', event.target.value)}
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
              {hasAdvancedFilters
                ? 'Ajusta los filtros para afinar la lista.'
                : 'Sin filtros avanzados activos.'}
            </span>
            {hasAdvancedFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-micro text-ink-secondary transition-colors hover:text-ink hover:underline"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Encounter list row ───────────────────────────────────────────

export function EncounterListRow({ encounter }: { encounter: Encounter }) {
  return (
    <Link href={`/atenciones/${encounter.id}`} className="group list-row">
      <div
        className={clsx(
          'list-row-icon h-12 w-12',
          encounter.status === 'COMPLETADO'
            ? 'bg-status-green/20 text-status-green'
            : encounter.status === 'EN_PROGRESO'
              ? 'border border-status-yellow/70 bg-status-yellow/35 text-accent-text'
              : 'bg-surface-base text-ink-secondary',
        )}
      >
        <FichaIcon className="h-5 w-5" aria-hidden="true" />
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
            {format(new Date(encounter.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })} hrs
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

      <FiChevronDown className="h-5 w-5 rotate-[-90deg] text-ink-muted group-hover:text-ink" aria-hidden="true" />
    </Link>
  );
}
