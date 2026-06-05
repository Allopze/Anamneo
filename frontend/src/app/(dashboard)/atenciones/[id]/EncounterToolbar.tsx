import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
  FiSave,
  FiCheck,
  FiAlertCircle,
  FiLoader,
  FiEye,
  FiShield,
  FiWifiOff,
  FiMoreHorizontal,
  FiCopy,
  FiActivity,
  FiClock,
} from 'react-icons/fi';
import { EncounterIcon } from '@/components/icons';
import { REVIEW_STATUS_LABELS } from '@/types';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';
import { FichaToolbarMenu, type ToolbarMenuItem } from './ficha/FichaToolbarMenu';
import type { EncounterWizardHook } from './useEncounterWizard';
import {
  DUPLICATE_ENCOUNTER_ACTION_TITLE,
  getDuplicateEncounterActionLabel,
} from '@/lib/encounter-duplicate';

type Props = Pick<
  EncounterWizardHook,
  | 'encounter'
  | 'canEdit'
  | 'canDuplicateEncounter'
  | 'canComplete'
  | 'canSign'
  | 'hasUnsavedChanges'
  | 'saveStatus'
  | 'saveStateLabel'
  | 'canViewAudit'
  | 'completionBlockedReason'
  | 'saveCurrentSection'
  | 'handleDuplicateEncounter'
  | 'handleComplete'
  | 'handleViewFicha'
  | 'openWorkspacePanel'
  | 'saveSectionMutation'
  | 'duplicateEncounterMutation'
  | 'completeMutation'
  | 'signMutation'
> & {
  setShowSignModal: (v: boolean) => void;
};

// Compact variants for SmartHeaderBar — extend the CSS .toolbar-btn foundation
const COMPACT_BTN =
  'toolbar-btn min-h-9 shrink-0 gap-1.5 px-2.5 py-1.5 text-xs xl:px-3';

const COMPACT_BTN_PRIMARY =
  'toolbar-btn-primary min-h-9 shrink-0 gap-1.5 px-2.5 py-1.5 text-xs xl:px-3';

const COMPACT_BTN_SUCCESS =
  'toolbar-btn-success min-h-9 shrink-0 gap-1.5 px-2.5 py-1.5 text-xs xl:px-3';

export default function EncounterToolbar({
  encounter,
  canEdit,
  canDuplicateEncounter,
  canComplete,
  canSign,
  hasUnsavedChanges,
  saveStatus,
  saveStateLabel,
  canViewAudit,
  completionBlockedReason,
  saveCurrentSection,
  handleDuplicateEncounter,
  handleComplete,
  handleViewFicha,
  openWorkspacePanel,
  saveSectionMutation,
  duplicateEncounterMutation,
  completeMutation,
  signMutation,
  setShowSignModal,
}: Props) {
  const headerBarSlot = useHeaderBarSlot();

  const reviewStatusLabel = REVIEW_STATUS_LABELS[encounter?.reviewStatus || 'NO_REQUIERE_REVISION'];

  const moreMenuItems = useMemo<ToolbarMenuItem[]>(() => {
    const items: ToolbarMenuItem[] = [];

    if (canEdit) {
      items.push({
        key: 'save',
        label: saveSectionMutation.isPending ? 'Guardando sección' : 'Guardar ahora',
        icon: FiSave,
        onSelect: saveCurrentSection,
        disabled: !hasUnsavedChanges || saveSectionMutation.isPending,
        title: hasUnsavedChanges ? 'Guardar la sección actual' : 'No hay cambios pendientes',
      });
    }

    items.push({
      key: 'ficha',
      label: 'Ficha clínica',
      icon: FiEye,
      onSelect: handleViewFicha,
      title: 'Ver ficha clínica de la atención',
    });

    items.push({
      key: 'revision',
      label: `Revisión: ${reviewStatusLabel}`,
      icon: FiActivity,
      onSelect: () => openWorkspacePanel('revision'),
      title: `Estado de revisión: ${reviewStatusLabel}`,
    });

    if (canDuplicateEncounter) {
      items.push({
        key: 'duplicate',
        label: getDuplicateEncounterActionLabel(duplicateEncounterMutation.isPending),
        icon: FiCopy,
        onSelect: handleDuplicateEncounter,
        disabled: duplicateEncounterMutation.isPending,
        title: DUPLICATE_ENCOUNTER_ACTION_TITLE,
      });
    }

    items.push({
      key: 'support',
      label: 'Apoyo clínico',
      icon: EncounterIcon,
      onSelect: () => openWorkspacePanel('apoyo'),
      title: 'Abrir notas, adjuntos y seguimiento',
    });

    if (canViewAudit) {
      items.push({
        key: 'history',
        label: 'Historial',
        icon: FiClock,
        onSelect: () => openWorkspacePanel('historial'),
        title: 'Ver historial de cambios de la atención',
      });
    }

    return items;
  }, [
    canDuplicateEncounter,
    canViewAudit,
    canEdit,
    duplicateEncounterMutation.isPending,
    handleViewFicha,
    handleDuplicateEncounter,
    hasUnsavedChanges,
    openWorkspacePanel,
    reviewStatusLabel,
    saveCurrentSection,
    saveSectionMutation.isPending,
  ]);

  const toolbarActions = useMemo(() => {
    if (!encounter) return null;

    const saveStatusIcon =
      saveStatus === 'saving' ? <FiLoader className="h-3 w-3 animate-spin" /> :
      saveStatus === 'saved' ? <FiCheck className="h-3 w-3" /> :
      saveStatus === 'queued' ? <FiWifiOff className="h-3 w-3" /> :
      saveStatus === 'error' ? <FiAlertCircle className="h-3 w-3" /> :
      <FiSave className="h-3 w-3" />;
    const saveStatusBadgeClass =
      saveStatus === 'error'
        ? 'border-status-red/40 bg-status-red/10 text-status-red-text'
        : saveStatus === 'saved'
          ? 'border-status-green/40 bg-status-green/10 text-status-green-text'
          : saveStatus === 'queued'
            ? 'border-status-yellow/60 bg-status-yellow/20 text-accent-text'
            : saveStatus === 'saving'
              ? 'border-frame/20 bg-surface-inset text-ink'
              : 'border-frame/10 bg-surface-base/70 text-ink-secondary';
    const reviewButtonClass =
      encounter.reviewStatus === 'REVISADA_POR_MEDICO'
        ? 'border-status-green/40 bg-status-green/10 text-status-green-text hover:bg-status-green/20'
        : encounter.reviewStatus === 'LISTA_PARA_REVISION'
          ? 'border-status-yellow/60 bg-status-yellow/20 text-accent-text hover:bg-status-yellow/30'
          : 'border-frame/10 bg-surface-base/70 text-ink-secondary hover:text-ink';

    return (
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2 overflow-x-auto py-0.5 md:flex-wrap md:overflow-visible">
        {/* ── Save status badge ─── */}
        {canEdit && saveStateLabel ? (
          <div
            className={clsx(
              'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              saveStatusBadgeClass,
            )}
            aria-live="polite"
            role="status"
          >
            {saveStatusIcon}
            <span className="hidden max-w-[13rem] truncate sm:inline">{saveStateLabel}</span>
          </div>
        ) : null}

        {/* ── Save button ─────── */}
        {canEdit ? (
          <button
            onClick={saveCurrentSection}
            disabled={!hasUnsavedChanges || saveSectionMutation.isPending}
            aria-label="Guardar ahora"
            className={clsx(
              hasUnsavedChanges ? COMPACT_BTN_PRIMARY : COMPACT_BTN,
              'hidden sm:inline-flex',
              !hasUnsavedChanges && 'bg-surface-inset text-ink-muted hover:bg-surface-inset',
            )}
          >
            <FiSave className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Guardar ahora</span>
          </button>
        ) : null}

        {/* ── Navigation buttons ─ */}
        <button onClick={handleViewFicha} aria-label="Ficha clínica" className={clsx(COMPACT_BTN, 'hidden sm:inline-flex')}>
          <FiEye className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Ficha clínica</span>
        </button>

        <button
          type="button"
          onClick={() => openWorkspacePanel('revision')}
          className={clsx(COMPACT_BTN, 'hidden sm:inline-flex', reviewButtonClass)}
          aria-label={`Estado de revisión: ${reviewStatusLabel}`}
          title={`Estado de revisión: ${reviewStatusLabel}`}
        >
          <FiActivity className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{reviewStatusLabel}</span>
        </button>

        {/* ── More menu ────────── */}
        <FichaToolbarMenu
          label="Acciones"
          ariaLabel="Más acciones de atención"
          icon={FiMoreHorizontal}
          items={moreMenuItems}
        />

        {/* ── Workflow CTA ─────── */}
        {canComplete ? (
          <button
            onClick={handleComplete}
            disabled={completeMutation.isPending || Boolean(completionBlockedReason)}
            aria-label="Finalizar atención"
            className={COMPACT_BTN_SUCCESS}
            title={completionBlockedReason ?? undefined}
          >
            <FiCheck className="h-3.5 w-3.5" />
            <span className="inline">Finalizar</span>
          </button>
        ) : null}

        {canSign ? (
          <button
            onClick={() => setShowSignModal(true)}
            disabled={signMutation.isPending}
            aria-label="Firmar atención"
            className={COMPACT_BTN_PRIMARY}
          >
            <FiShield className="h-3.5 w-3.5" />
            <span className="inline">Firmar</span>
          </button>
        ) : null}
      </div>
    );
  }, [
    encounter,
    canEdit,
    saveStateLabel,
    saveStatus,
    hasUnsavedChanges,
    saveSectionMutation.isPending,
    saveCurrentSection,
    handleViewFicha,
    openWorkspacePanel,
    reviewStatusLabel,
    moreMenuItems,
    canComplete,
    completeMutation.isPending,
    completionBlockedReason,
    handleComplete,
    canSign,
    signMutation.isPending,
    setShowSignModal,
  ]);

  // Inject into SmartHeaderBar context slot
  useEffect(() => {
    if (!headerBarSlot || !toolbarActions) return;

    headerBarSlot.setHeaderBarSlot(toolbarActions);
    return () => {
      headerBarSlot.setHeaderBarSlot(null);
    };
  }, [headerBarSlot, toolbarActions]);

  // Fallback: render inline when SmartHeaderBar is not available
  if (!headerBarSlot && toolbarActions) {
    return (
      <div className="no-print sticky top-0 z-30 border-b border-surface-muted/30 bg-surface-elevated px-4 py-2">
        <div className="mx-auto max-w-7xl">
          {toolbarActions}
        </div>
      </div>
    );
  }

  return null;
}
