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
    <section className="overflow-hidden rounded-card border border-surface-muted/40 bg-surface-elevated shadow-soft">
      <div className="border-b border-surface-muted/35 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-ink-primary">Recuperación local</h3>
            <p className="mt-1 text-sm text-ink-secondary">Borradores y conflictos listos para revisar.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-input border border-surface-muted/40 bg-surface-base px-3 py-2 text-xs font-medium text-ink-secondary">
            <FiClock className="h-3.5 w-3.5" />
            {recoverableConflicts.length > 0
              ? `${recoverableConflicts.length} copia${recoverableConflicts.length === 1 ? '' : 's'} en conflicto`
              : 'Solo borrador local activo'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {localDraft ? (
          <article className="rounded-card border border-surface-muted/40 bg-surface-base/70 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-muted/40 bg-surface-elevated text-ink-secondary">
                <FiSave className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-primary">Borrador local activo</p>
                <p className="mt-1 text-sm leading-6 text-ink-secondary">
                  Se sigue guardando automáticamente en este navegador para que no pierdas trabajo si recargas o cortas
                  la sesión.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md border border-surface-muted/35 bg-surface-elevated px-3 py-1 text-ink-secondary">
                    Último guardado local: {formatSavedAt(localDraft.savedAt)}
                  </span>
                  <span className="rounded-md border border-surface-muted/35 bg-surface-elevated px-3 py-1 text-ink-secondary">
                    Sección recordada: {draftSectionLabel}
                  </span>
                </div>
                {localDraft.currentSectionIndex !== currentSectionIndex ? (
                  <button
                    type="button"
                    onClick={() => moveToSection(localDraft.currentSectionIndex)}
                    className="mt-4 inline-flex items-center gap-2 rounded-input border border-surface-muted/40 px-3 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-surface-muted/25"
                  >
                    <FiRotateCcw className="h-3.5 w-3.5" />
                    Volver a la última sección trabajada
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ) : (
          <article className="rounded-card border border-dashed border-surface-muted/45 bg-surface-base/55 p-4 text-sm text-ink-secondary">
            No hay borrador local pendiente fuera de lo ya sincronizado con servidor.
          </article>
        )}

        <article className="rounded-card border border-surface-muted/40 bg-surface-base/70 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-muted/40 bg-surface-elevated text-ink-secondary">
              <FiAlertTriangle className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-primary">Copias locales en conflicto</p>
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
                      'rounded-card border p-4 transition-colors',
                      isActive ? 'border-surface-muted/60 bg-surface-elevated' : 'border-surface-muted/35 bg-surface-base/45',
                    )}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink-primary">
                            {sectionLabelByKey[conflict.sectionKey] ?? conflict.sectionKey}
                          </p>
                          <span className="rounded-md border border-surface-muted/35 bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-ink-secondary">
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
                            className="rounded-input border border-surface-muted/40 px-3 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-surface-muted/25"
                          >
                            Ir a la sección
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onRestoreConflict(conflict.sectionKey)}
                          className="inline-flex items-center gap-2 rounded-input bg-frame-dark px-3 py-2 text-xs font-semibold text-text-on-dark transition-colors hover:bg-frame-darker"
                        >
                          <FiRefreshCw className="h-3.5 w-3.5" />
                          Restaurar mi copia
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissConflict(conflict.sectionKey)}
                          className="inline-flex items-center gap-2 rounded-input border border-surface-muted/40 px-3 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-surface-muted/25"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                          Descartar
                        </button>
                      </div>
                    </div>

                    {preview.items.length > 0 ? (
                      <div className="mt-4 overflow-hidden rounded-card border border-surface-muted/35">
                        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] bg-surface-elevated px-3 py-2 text-xs font-semibold text-ink-secondary">
                          <span>Campo</span>
                          <span>Servidor</span>
                          <span>Mi copia</span>
                        </div>
                        <div className="divide-y divide-surface-muted/25">
                          {preview.items.map((item) => (
                            <div
                              key={`${conflict.sectionKey}-${item.fieldLabel}`}
                              className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-surface-base/65 px-3 py-3 text-sm"
                            >
                              <p className="font-medium text-ink-primary">{item.fieldLabel}</p>
                              <p className="text-ink-secondary">{item.serverValue}</p>
                              <p className="font-medium text-ink-primary">{item.localValue}</p>
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
