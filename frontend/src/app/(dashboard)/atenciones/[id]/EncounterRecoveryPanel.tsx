'use client';

import clsx from 'clsx';
import { FiAlertTriangle, FiClock, FiRefreshCw, FiRotateCcw, FiSave, FiTrash2 } from 'react-icons/fi';
import type { EncounterDraft, EncounterSectionConflictBackup } from '@/lib/encounter-draft';
import { buildEncounterConflictPreview } from '@/lib/encounter-conflict';
import type { SectionKey } from '@/types';

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatSavedAt(value?: string) {
  if (!value) {
    return 'recién';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'recién' : dateTimeFormatter.format(parsed);
}

interface EncounterRecoveryPanelProps {
  currentSectionKey?: SectionKey;
  currentSectionIndex: number;
  localDraft: EncounterDraft | null;
  recoverableConflicts: EncounterSectionConflictBackup[];
  sectionLabelByKey: Record<string, string>;
  moveToSection: (index: number) => void;
  getSectionIndex: (sectionKey: string) => number;
  onRestoreConflict: (sectionKey?: string) => void;
  onDismissConflict: (sectionKey?: string) => void;
}

export default function EncounterRecoveryPanel({
  currentSectionKey,
  currentSectionIndex,
  localDraft,
  recoverableConflicts,
  sectionLabelByKey,
  moveToSection,
  getSectionIndex,
  onRestoreConflict,
  onDismissConflict,
}: EncounterRecoveryPanelProps) {
  if (!localDraft && recoverableConflicts.length === 0) {
    return null;
  }

  const draftSectionLabel = localDraft
    ? Object.entries(sectionLabelByKey)[localDraft.currentSectionIndex]?.[1] ?? `Paso ${localDraft.currentSectionIndex + 1}`
    : null;

  return (
    <section className="overflow-hidden rounded-[28px] border border-surface-muted/45 bg-[linear-gradient(135deg,rgba(255,248,231,0.92),rgba(255,255,255,0.98))] shadow-[0_18px_60px_-40px_rgba(120,84,0,0.45)]">
      <div className="border-b border-amber-200/80 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-amber-800/80">
              Recuperación local
            </p>
            <h3 className="mt-1 text-lg font-semibold text-amber-950">Borradores y conflictos listos para revisar</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-white/80 px-3 py-1 text-xs font-medium text-amber-900">
            <FiClock className="h-3.5 w-3.5" />
            {recoverableConflicts.length > 0
              ? `${recoverableConflicts.length} copia${recoverableConflicts.length === 1 ? '' : 's'} en conflicto`
              : 'Solo borrador local activo'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {localDraft ? (
          <article className="rounded-[24px] border border-white/90 bg-white/88 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
                <FiSave className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Borrador local activo</p>
                <p className="mt-1 text-sm leading-6 text-ink-secondary">
                  Se sigue guardando automáticamente en este navegador para que no pierdas trabajo si recargas o cortas
                  la sesión.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-surface-base px-3 py-1 text-ink-secondary">
                    Último guardado local: {formatSavedAt(localDraft.savedAt)}
                  </span>
                  <span className="rounded-full bg-surface-base px-3 py-1 text-ink-secondary">
                    Sección recordada: {draftSectionLabel}
                  </span>
                </div>
                {localDraft.currentSectionIndex !== currentSectionIndex ? (
                  <button
                    type="button"
                    onClick={() => moveToSection(localDraft.currentSectionIndex)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-50"
                  >
                    <FiRotateCcw className="h-3.5 w-3.5" />
                    Volver a la última sección trabajada
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ) : (
          <article className="rounded-[24px] border border-dashed border-amber-300/80 bg-white/65 p-4 text-sm text-ink-secondary">
            No hay borrador local pendiente fuera de lo ya sincronizado con servidor.
          </article>
        )}

        <article className="rounded-[24px] border border-white/90 bg-white/92 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
              <FiAlertTriangle className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Copias locales en conflicto</p>
              <p className="mt-1 text-sm leading-6 text-ink-secondary">
                Cuando otra sesión guarda antes que tú, dejamos aquí una copia recuperable y un resumen corto contra la
                versión actual del servidor.
              </p>
            </div>
          </div>

          {recoverableConflicts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {recoverableConflicts.map((conflict) => {
                const preview = buildEncounterConflictPreview(conflict.localData, conflict.serverData);
                const sectionIndex = getSectionIndex(conflict.sectionKey);
                const isActive = currentSectionKey === conflict.sectionKey;

                return (
                  <div
                    key={conflict.sectionKey}
                    className={clsx(
                      'rounded-[22px] border p-4 transition-colors',
                      isActive ? 'border-amber-300 bg-amber-50/80' : 'border-surface-muted/45 bg-surface-base/70',
                    )}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink">
                            {sectionLabelByKey[conflict.sectionKey] ?? conflict.sectionKey}
                          </p>
                          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-ink-secondary">
                            {preview.totalDifferences} cambio{preview.totalDifferences === 1 ? '' : 's'} detectado
                            {preview.totalDifferences === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-secondary">
                          Copia local guardada {formatSavedAt(conflict.savedAt)}. Servidor actualizado{' '}
                          {formatSavedAt(conflict.serverUpdatedAt)}.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isActive && sectionIndex >= 0 ? (
                          <button
                            type="button"
                            onClick={() => moveToSection(sectionIndex)}
                            className="rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-50"
                          >
                            Ir a la sección
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onRestoreConflict(conflict.sectionKey)}
                          className="inline-flex items-center gap-2 rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
                        >
                          <FiRefreshCw className="h-3.5 w-3.5" />
                          Restaurar mi copia
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissConflict(conflict.sectionKey)}
                          className="inline-flex items-center gap-2 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-50"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                          Descartar
                        </button>
                      </div>
                    </div>

                    {preview.items.length > 0 ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-surface-muted/35">
                        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] bg-surface-base/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-secondary">
                          <span>Campo</span>
                          <span>Servidor</span>
                          <span>Mi copia</span>
                        </div>
                        <div className="divide-y divide-surface-muted/25">
                          {preview.items.map((item) => (
                            <div
                              key={`${conflict.sectionKey}-${item.fieldLabel}`}
                              className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-white/80 px-3 py-3 text-sm"
                            >
                              <p className="font-medium text-ink">{item.fieldLabel}</p>
                              <p className="text-ink-secondary">{item.serverValue}</p>
                              <p className="font-medium text-amber-950">{item.localValue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-ink-secondary">
                        El cambio no se puede resumir en pocos campos, pero la copia sigue recuperable.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-secondary">No hay copias locales en conflicto para esta atención.</p>
          )}
        </article>
      </div>
    </section>
  );
}
