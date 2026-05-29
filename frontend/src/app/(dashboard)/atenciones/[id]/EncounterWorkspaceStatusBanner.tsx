import { FiAlertCircle, FiRefreshCw, FiWifiOff } from 'react-icons/fi';
import type { EncounterSectionConflictBackup } from '@/lib/encounter-draft';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'queued' | 'error';

interface EncounterWorkspaceStatusBannerProps {
  conflict?: EncounterSectionConflictBackup | null;
  conflictLabel?: string;
  isOnline: boolean;
  isViewingConflictSection: boolean;
  onGoToConflict: () => void;
  onRestoreConflict: () => void;
  onRetrySave: () => void;
  pendingSaveCount: number;
  saveStateLabel?: string | null;
  saveStatus: SaveStatus;
}

export default function EncounterWorkspaceStatusBanner({
  conflict,
  conflictLabel,
  isOnline,
  isViewingConflictSection,
  onGoToConflict,
  onRestoreConflict,
  onRetrySave,
  pendingSaveCount,
  saveStateLabel,
  saveStatus,
}: EncounterWorkspaceStatusBannerProps) {
  if (conflict) {
    return (
      <section
        className="rounded-card border border-status-yellow/70 bg-status-yellow/20 px-4 py-4 text-sm text-ink shadow-soft"
        role="alert"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <FiRefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Copia local protegida para comparar</p>
              <p className="leading-6 text-ink-secondary">
                La sección <strong>{conflictLabel ?? conflict.sectionKey}</strong> ya fue recargada con la versión del
                servidor. Puedes restaurar tu copia local o revisar la versión vigente antes de seguir.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isViewingConflictSection ? (
              <button type="button" onClick={onRestoreConflict} className="btn btn-primary">
                Restaurar mi copia
              </button>
            ) : (
              <button type="button" onClick={onGoToConflict} className="btn btn-secondary">
                Ir a la sección
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!isOnline || pendingSaveCount > 0 || saveStatus === 'queued') {
    const pendingText =
      pendingSaveCount > 0
        ? `${pendingSaveCount} cambio${pendingSaveCount > 1 ? 's' : ''} pendiente${pendingSaveCount > 1 ? 's' : ''}`
        : saveStateLabel ?? 'Guardado en cola local';

    return (
      <section
        className="rounded-card border border-surface-muted/80 bg-surface-elevated px-4 py-4 text-sm text-ink shadow-soft"
        role="status"
      >
        <div className="flex gap-3">
          <FiWifiOff className="mt-0.5 h-5 w-5 shrink-0 text-ink-secondary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">{isOnline ? pendingText : 'Sin conexión'}</p>
            <p className="leading-6 text-ink-secondary">
              Los cambios se conservan localmente y se sincronizarán cuando vuelva la conexión.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (saveStatus === 'error') {
    return (
      <section
        className="rounded-card border border-status-red/60 bg-status-red/15 px-4 py-4 text-sm text-status-red-text shadow-soft"
        role="alert"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">{saveStateLabel ?? 'No se pudo guardar'}</p>
              <p className="leading-6">Revisa tu conexión o intenta guardar nuevamente la sección actual.</p>
            </div>
          </div>
          <button type="button" onClick={onRetrySave} className="btn btn-secondary">
            Reintentar guardado
          </button>
        </div>
      </section>
    );
  }

  return null;
}
