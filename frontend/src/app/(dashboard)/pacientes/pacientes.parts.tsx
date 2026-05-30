'use client';

/**
 * Sub-components used by pacientes/page.tsx.
 */

import Link from 'next/link';
import clsx from 'clsx';
import { FiCalendar, FiChevronRight, FiPlus, FiUser } from 'react-icons/fi';
import type { Patient, PatientCompletenessStatus } from '@/types';
import { formatPatientAge, formatPatientPrevision, formatPatientSex, getPatientCompletenessMeta } from '@/lib/patient';

// ── Completeness KPI summary ──────────────────────────────────────

interface SummaryCard {
  status: PatientCompletenessStatus;
  label: string;
  value: number;
  description: string;
}

interface PatientCompletenessSummaryProps {
  cards: SummaryCard[];
  activeFilter: PatientCompletenessStatus | undefined;
  onFilterChange: (key: string, value: string) => void;
}

export function PatientCompletenessSummary({
  cards,
  activeFilter,
  onFilterChange,
}: PatientCompletenessSummaryProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => {
          const isActive = activeFilter === card.status;
          return (
            <button
              key={card.status}
              type="button"
              aria-pressed={isActive}
              onClick={() => onFilterChange('completenessStatus', isActive ? '' : card.status)}
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
  );
}

// ── Patient list row ─────────────────────────────────────────────

interface PatientListRowProps {
  patient: Patient;
  isAdmin: boolean;
  canRestoreArchived: boolean;
  isRestoring: boolean;
  onRestore: (patientId: string) => void;
}

export function PatientListRow({
  patient,
  isAdmin,
  canRestoreArchived,
  isRestoring,
  onRestore,
}: PatientListRowProps) {
  const completenessMeta = getPatientCompletenessMeta(patient);
  const isArchived = Boolean(patient.archivedAt);
  const patientHref = isAdmin
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
          <span className={`list-chip ${completenessMeta.badgeClassName}`}>
            {completenessMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-body text-ink-muted">
          <span>{patient.rut || 'Sin RUT'}</span>
          <span>{formatPatientSex(patient.sexo)}</span>
          <span>{formatPatientPrevision(patient.prevision)}</span>
          {(patient as any)._count && (
            <span className="flex items-center gap-1">
              <FiCalendar className="w-3 h-3" />
              {(patient as any)._count.encounters} atenciones
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (isArchived) {
    return (
      <div className="list-row">
        {rowContent}
        {canRestoreArchived ? (
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => onRestore(patient.id)}
            disabled={isRestoring}
          >
            Restaurar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Link href={patientHref} className="group list-row">
      {rowContent}
      <FiChevronRight className="w-5 h-5 text-ink-muted group-hover:text-ink" />
    </Link>
  );
}

// ── Empty state CTA ──────────────────────────────────────────────

export function NewPatientEmptyStateCta() {
  return (
    <Link href="/pacientes/nuevo" className="empty-state-cta">
      <FiPlus className="w-5 h-5 mr-2" />
      Registrar primer paciente
    </Link>
  );
}
