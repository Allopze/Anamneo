'use client';

/**
 * Small presentational sub-components for the encounter wizard page.
 */

import { FiCalendar } from 'react-icons/fi';
import LocalizedDateInput from '@/components/common/LocalizedDateInput';

// ── Loading skeleton ─────────────────────────────────────────────

export function EncounterWorkspaceSkeleton() {
  return (
    <div className="min-h-screen bg-surface-base p-4" aria-busy="true" aria-label="Cargando atención">
      <div className="mb-4 h-16 rounded-card bg-surface-elevated shadow-soft" />
      <div className="mb-5 h-28 rounded-card bg-surface-elevated shadow-soft" />
      <div className="grid gap-5 xl:grid-cols-[264px_minmax(0,1fr)]">
        <div className="hidden space-y-3 rounded-card border border-surface-muted/35 bg-surface-elevated p-4 xl:block">
          {[...Array(7)].map((_, index) => (
            <div key={index} className="h-10 w-full skeleton" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-20 rounded-card bg-surface-elevated shadow-soft" />
          <div className="h-[28rem] rounded-card bg-surface-elevated shadow-soft" />
        </div>
      </div>
    </div>
  );
}

// ── Follow-up task suggestion modal ─────────────────────────────

interface EncounterFollowupModalProps {
  suggestion: { diagnosisText: string; days: number } | null;
  followupDate: string;
  isPending: boolean;
  onDateChange: (date: string) => void;
  onSkip: () => void;
  onConfirm: () => void;
}

export function EncounterFollowupModal({
  suggestion,
  followupDate,
  isPending,
  onDateChange,
  onSkip,
  onConfirm,
}: EncounterFollowupModalProps) {
  if (!suggestion) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-modal-title"
    >
      <div className="w-full max-w-sm rounded-card border border-surface-muted/40 bg-surface-elevated p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <FiCalendar className="h-4 w-4 text-accent-text" />
          </div>
          <h2 id="followup-modal-title" className="text-base font-bold text-ink">
            Crear próximo control
          </h2>
        </div>
        <p className="mb-4 text-sm text-ink-secondary">
          El diagnóstico <strong className="text-ink">{suggestion.diagnosisText}</strong> sugiere un
          control en {suggestion.days} días. ¿Deseas crear un seguimiento?
        </p>
        <div className="mb-5">
          <label className="form-label text-xs">Fecha del control</label>
          <LocalizedDateInput
            id="followup-date"
            value={followupDate}
            onChange={onDateChange}
            className="form-input mt-0.5"
            min={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={isPending}
            className="btn btn-secondary text-sm"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !followupDate}
            className="btn btn-primary text-sm"
          >
            {isPending ? 'Creando…' : 'Crear control'}
          </button>
        </div>
      </div>
    </div>
  );
}
