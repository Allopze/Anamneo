import Link from 'next/link';
import clsx from 'clsx';
import {
  FiArrowLeft,
  FiCheck,
  FiCopy,
  FiSave,
  FiAlertCircle,
  FiLoader,
  FiEye,
  FiActivity,
  FiClock,
  FiShield,
  FiWifiOff,
  FiLayout,
} from 'react-icons/fi';
import { REVIEW_STATUS_LABELS } from '@/types';
import type { EncounterWizardHook } from './useEncounterWizard';
import { setEncounterDrawerOpen } from './encounter-drawer-state';
import {
  TOOLBAR_BUTTON_CLASS,
  TOOLBAR_PRIMARY_BUTTON_CLASS,
  TOOLBAR_SUCCESS_BUTTON_CLASS,
  formatDateTime,
} from './encounter-wizard.constants';

type Props = Pick<
  EncounterWizardHook,
  | 'encounter'
  | 'sections'
  | 'completedCount'
  | 'progressPercentage'
  | 'elapsedMinutes'
  | 'isOnline'
  | 'pendingSaveCount'
  | 'canEdit'
  | 'canDuplicateEncounter'
  | 'canComplete'
  | 'canSign'
  | 'hasUnsavedChanges'
  | 'saveStatus'
  | 'saveStateLabel'
  | 'saveStateToneClass'
  | 'drawerShortcutHint'
  | 'isDrawerOpen'
  | 'setIsDrawerOpen'
  | 'completionBlockedReason'
  | 'saveCurrentSection'
  | 'handleDuplicateEncounter'
  | 'handleComplete'
  | 'handleViewFicha'
  | 'openDrawerTab'
  | 'saveSectionMutation'
  | 'duplicateEncounterMutation'
  | 'completeMutation'
  | 'signMutation'
> & {
  setShowSignModal: (v: boolean) => void;
};

export default function EncounterHeader({
  encounter,
  sections,
  completedCount,
  progressPercentage,
  elapsedMinutes,
  isOnline,
  pendingSaveCount,
  canEdit,
  canDuplicateEncounter,
  canComplete,
  canSign,
  hasUnsavedChanges,
  saveStatus,
  saveStateLabel,
  saveStateToneClass,
  drawerShortcutHint,
  isDrawerOpen,
  setIsDrawerOpen,
  completionBlockedReason,
  saveCurrentSection,
  handleDuplicateEncounter,
  handleComplete,
  handleViewFicha,
  openDrawerTab,
  saveSectionMutation,
  duplicateEncounterMutation,
  completeMutation,
  signMutation,
  setShowSignModal,
}: Props) {
  if (!encounter) return null;

  return (
    <header className="border-b border-frame/10 bg-surface-elevated/96">
      <div className="w-full px-4 py-5 lg:px-8 xl:px-10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <Link
                href={`/pacientes/${encounter.patientId}`}
                aria-label="Volver al paciente"
                className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-input border border-surface-muted/45 bg-surface-base text-ink-secondary transition-colors hover:bg-surface-muted/18 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20"
              >
                <FiArrowLeft className="h-4.5 w-4.5" />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
                  <span>Atención</span>
                  <span>{encounter.patient?.rut || 'Sin RUT'}</span>
                  <span>{formatDateTime(encounter.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <FiClock className="h-3.5 w-3.5" />
                    {elapsedMinutes < 60
                      ? `${elapsedMinutes} min`
                      : `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`}
                  </span>
                </div>
                <h1 className="mt-1 truncate text-[1.75rem] font-extrabold tracking-tight text-ink lg:text-[2rem]">
                  {encounter.patient?.nombre}
                </h1>
                {encounter.patient && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                    {encounter.patient.edad != null && (
                      <span className="inline-flex items-center rounded-full border border-surface-muted/50 bg-surface-base px-2.5 py-1">
                        {encounter.patient.edad} años{encounter.patient.edadMeses ? ` ${encounter.patient.edadMeses}m` : ''}
                      </span>
                    )}
                    {encounter.patient.sexo && (
                      <span className="inline-flex items-center rounded-full border border-surface-muted/50 bg-surface-base px-2.5 py-1">
                        {encounter.patient.sexo}
                      </span>
                    )}
                    {encounter.patient.prevision && (
                      <span className="inline-flex items-center rounded-full border border-surface-muted/50 bg-surface-base px-2.5 py-1">
                        {encounter.patient.prevision}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-4 max-w-2xl">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-secondary">Progreso de la atención</span>
                    <span className="font-medium text-ink">
                      {completedCount}/{sections.length} secciones
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted/45">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {(!isOnline || pendingSaveCount > 0) && (
              <div
                className={clsx(
                  'inline-flex min-h-12 items-center gap-2 rounded-input border px-4 py-3 text-sm shadow-soft',
                  !isOnline
                    ? 'border-status-amber/40 bg-status-amber/10 text-status-amber-text'
                    : 'border-accent/40 bg-accent/10 text-accent-text',
                )}
                role="status"
              >
                <FiWifiOff className="h-4 w-4" />
                {!isOnline
                  ? `Sin conexión${pendingSaveCount > 0 ? ` · ${pendingSaveCount} pendiente${pendingSaveCount > 1 ? 's' : ''}` : ''}`
                  : `Sincronizando ${pendingSaveCount} cambio${pendingSaveCount > 1 ? 's' : ''}…`}
              </div>
            )}
            {canEdit && saveStateLabel ? (
              <div
                className={clsx(
                  'inline-flex min-h-12 items-center gap-2 rounded-input border border-frame/15 bg-surface-elevated px-4 py-3 text-sm shadow-soft',
                  saveStateToneClass,
                )}
                aria-live="polite"
                role="status"
              >
                {saveStatus === 'saving' ? (
                  <FiLoader className="h-4 w-4 animate-spin" />
                ) : saveStatus === 'saved' ? (
                  <FiCheck className="h-4 w-4" />
                ) : saveStatus === 'error' ? (
                  <FiAlertCircle className="h-4 w-4" />
                ) : (
                  <FiSave className="h-4 w-4" />
                )}
                {saveStateLabel}
              </div>
            ) : null}

            {canEdit ? (
              <button
                onClick={saveCurrentSection}
                disabled={!hasUnsavedChanges || saveSectionMutation.isPending}
                className={TOOLBAR_PRIMARY_BUTTON_CLASS}
              >
                <FiSave className="h-4 w-4" />
                Guardar Ahora
              </button>
            ) : null}

            <button onClick={handleViewFicha} className={TOOLBAR_BUTTON_CLASS}>
              <FiEye className="h-4 w-4" />
              Ficha Clínica
            </button>

            {canDuplicateEncounter ? (
              <button
                type="button"
                onClick={handleDuplicateEncounter}
                disabled={duplicateEncounterMutation.isPending}
                className={TOOLBAR_BUTTON_CLASS}
                title="Crear un nuevo borrador a partir de esta atención"
              >
                <FiCopy className="h-4 w-4" />
                {duplicateEncounterMutation.isPending ? 'Duplicando…' : 'Duplicar'}
              </button>
            ) : null}

            {canComplete ? (
              <button
                onClick={handleComplete}
                disabled={completeMutation.isPending || Boolean(completionBlockedReason)}
                className={TOOLBAR_SUCCESS_BUTTON_CLASS}
                title={completionBlockedReason ?? undefined}
              >
                <FiCheck className="h-4 w-4" />
                Finalizar Atención
              </button>
            ) : null}

            {canSign ? (
              <button
                onClick={() => setShowSignModal(true)}
                disabled={signMutation.isPending}
                className={TOOLBAR_PRIMARY_BUTTON_CLASS}
              >
                <FiShield className="h-4 w-4" />
                Firmar Atención
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => openDrawerTab('revision')}
              aria-label={`Estado de revisión: ${REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}. Abrir panel de revisión`}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors hover:border-frame/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20',
                encounter.reviewStatus === 'REVISADA_POR_MEDICO'
                  ? 'border-status-green/40 bg-status-green/14 text-status-green-text'
                  : encounter.reviewStatus === 'LISTA_PARA_REVISION'
                    ? 'border-status-yellow/50 bg-status-yellow/14 text-accent-text'
                    : 'border-frame/15 bg-surface-elevated text-ink-secondary',
              )}
            >
              <FiActivity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {REVIEW_STATUS_LABELS[encounter.reviewStatus || 'NO_REQUIERE_REVISION']}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setIsDrawerOpen((prev: boolean) => {
                  const next = !prev;
                  setEncounterDrawerOpen(next);
                  return next;
                })
              }
              className={clsx(TOOLBAR_BUTTON_CLASS, 'relative')}
              aria-label="Abrir panel lateral con revisión, apoyo, cierre e historial"
              title={`${drawerShortcutHint} para alternar`}
            >
              <FiLayout className="h-4 w-4" />
              <span className="hidden sm:inline">Panel lateral</span>
              {encounter.reviewStatus === 'LISTA_PARA_REVISION' && !isDrawerOpen && (
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-yellow opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-yellow" />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
