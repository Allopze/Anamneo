'use client';

import { useState } from 'react';
import type { Patient } from '@/types';

interface CheckedField {
  label: string;
  filled: boolean;
}

function computeFields(patient: Patient): CheckedField[] {
  const h = patient.history;

  function hasText(v: unknown): boolean {
    if (!v) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'object' && v !== null) {
      const obj = v as Record<string, unknown>;
      if ('notApplicable' in obj && obj.notApplicable === true) return true;
      if ('text' in obj) return typeof obj.text === 'string' && obj.text.trim().length > 0;
    }
    return false;
  }

  return [
    { label: 'Fecha de nacimiento', filled: Boolean(patient.fechaNacimiento) },
    { label: 'Sexo', filled: Boolean(patient.sexo) },
    { label: 'Previsión', filled: Boolean(patient.prevision) },
    { label: 'RUT o exención', filled: Boolean(patient.rut) || patient.rutExempt },
    { label: 'Teléfono', filled: Boolean(patient.telefono) },
    { label: 'Domicilio', filled: Boolean(patient.domicilio) },
    { label: 'Antecedentes médicos', filled: hasText(h?.antecedentesMedicos) },
    { label: 'Antecedentes familiares', filled: hasText(h?.antecedentesFamiliares) },
    { label: 'Medicamentos actuales', filled: hasText(h?.medicamentos) },
    { label: 'Alergias (texto libre)', filled: hasText(h?.alergias) },
    { label: 'Hábitos', filled: hasText(h?.habitos) },
    { label: 'Antecedentes quirúrgicos', filled: hasText(h?.antecedentesQuirurgicos) },
  ];
}

interface Props {
  patient: Patient;
}

export default function PatientCompletenessWidget({ patient }: Props) {
  const [expanded, setExpanded] = useState(false);
  const fields = computeFields(patient);
  const filled = fields.filter((f) => f.filled).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);
  const missing = fields.filter((f) => !f.filled);

  const color =
    pct >= 90 ? 'bg-status-green text-status-green-text' :
    pct >= 60 ? 'bg-status-yellow text-accent-text' :
    'bg-status-red text-white';

  const barColor =
    pct >= 90 ? 'bg-status-green' :
    pct >= 60 ? 'bg-status-yellow' :
    'bg-status-red';

  return (
    <div className="rounded-card border border-surface-muted/30 bg-surface-elevated px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
            {pct}% completa
          </span>
          {missing.length > 0 && (
            <span className="text-xs text-ink-muted">
              {missing.length} campo{missing.length !== 1 ? 's' : ''} pendiente{missing.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {missing.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-ink-secondary underline hover:no-underline"
          >
            {expanded ? 'Ocultar' : 'Ver pendientes'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted/50">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Completitud de ficha: ${pct}%`}
        />
      </div>

      {expanded && missing.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {missing.map((f) => (
            <li key={f.label} className="rounded-full bg-surface-muted/40 px-2 py-0.5 text-[11px] text-ink-muted">
              {f.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
