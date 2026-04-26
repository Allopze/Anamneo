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
  FiLayout,
  FiMoreHorizontal,
  FiCopy,
  FiActivity,
} from 'react-icons/fi';
import { REVIEW_STATUS_LABELS } from '@/types';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';
import { FichaToolbarMenu, type ToolbarMenuItem } from './ficha/FichaToolbarMenu';
import { setEncounterDrawerOpen } from './encounter-drawer-state';
import type { EncounterWizardHook } from './useEncounterWizard';
import {
  DUPLICATE_ENCOUNTER_ACTION_TITLE,
  getDuplicateEncounterActionLabel,
} from '@/lib/encounter-duplicate';

type Props = Pick<
  EncounterWizardHook,
  | 'encounter'
  | 'sections'
  | 'completedCount'
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

// Compact variants for SmartHeaderBar — extend the CSS .toolbar-btn foundation
const COMPACT_BTN =
  'toolbar-btn min-h-9 gap-1.5 px-2.5 py-1.5 text-xs';

const COMPACT_BTN_PRIMARY =
  'toolbar-btn-primary min-h-9 gap-1.5 px-2.5 py-1.5 text-xs';

const COMPACT_BTN_SUCCESS =
  'toolbar-btn-success min-h-9 gap-1.5 px-2.5 py-1.5 text-xs';

export default function EncounterToolbar({
  encounter,
  sections,
  completedCount,
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
  const headerBarSlot = useHeaderBarSlot();

  const reviewStatusLabel = REVIEW_STATUS_LABELS[encounter?.reviewStatus || 'NO_REQUIERE_REVISION'];

  const moreMenuItems = useMemo<ToolbarMenuItem[]>(() => {
    const items: ToolbarMenuItem[] = [];

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
      key: 'review',
      label: `Revisión: ${reviewStatusLabel}`,
      icon: FiActivity,
      onSelect: () => openDrawerTab('revision'),
      title: `Estado de revisión: ${reviewStatusLabel}`,
    });

    return items;
  }, [
    canDuplicateEncounter,
    duplicateEncounterMutation.isPending,
    handleDuplicateEncounter,
    openDrawerTab,
    reviewStatusLabel,
  ]);

  const toolbarActions = useMemo(() => {
    if (!encounter) return null;

    const saveStatusIcon =
      saveStatus === 'saving' ? <FiLoader className="h-3 w-3 animate-spin" /> :
      saveStatus === 'saved' ? <FiCheck className="h-3 w-3" /> :
      saveStatus === 'queued' ? <FiWifiOff className="h-3 w-3" /> :
      saveStatus === 'error' ? <FiAlertCircle className="h-3 w-3" /> :
      <FiSave className="h-3 w-3" />;

    return (
      <div className="flex min-w-0 items-center justify-end gap-1.5 py-0.5">
        {/* ── Progress chip ─────── */}
        <span className="hidden items-center gap-1.5 rounded-md border border-frame/10 bg-surface-base/60 px-2 py-1 text-[11px] font-medium text-ink-secondary xl:inline-flex">
          <span className="font-bold text-ink">{completedCount}/{sections.length}</span>
          secciones
        </span>

        {/* ── Save status badge ─── */}
        {canEdit && saveStateLabel ? (
          <div
            className={clsx(
              'inline-flex items-center gap-1 rounded-md border border-frame/10 px-2 py-1 text-[11px] font-medium transition-colors',
              saveStateToneClass,
            )}
            aria-live="polite"
            role="status"
          >
            {saveStatusIcon}
            <span className="hidden sm:inline">{saveStateLabel}</span>
          </div>
        ) : null}

        {/* ── Divider ──────────── */}
        <div className="mx-0.5 hidden h-5 w-px bg-surface-muted/60 sm:block" aria-hidden="true" />

        {/* ── Save button ─────── */}
        {canEdit ? (
          <button
            onClick={saveCurrentSection}
            disabled={!hasUnsavedChanges || saveSectionMutation.isPending}
            className={COMPACT_BTN_PRIMARY}
          >
            <FiSave className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Guardar</span>
          </button>
        ) : null}

        {/* ── Navigation buttons ─ */}
        <button onClick={handleViewFicha} className={COMPACT_BTN}>
          <FiEye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ficha</span>
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
          className={clsx(COMPACT_BTN, 'relative')}
          aria-label="Abrir panel lateral con revisión, apoyo, cierre e historial"
          title={`${drawerShortcutHint} para alternar`}
        >
          <FiLayout className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Panel</span>
          {encounter.reviewStatus === 'LISTA_PARA_REVISION' && !isDrawerOpen && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-yellow opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-status-yellow" />
            </span>
          )}
        </button>

        {/* ── More menu ────────── */}
        <FichaToolbarMenu
          label="Más"
          ariaLabel="Más acciones de atención"
          icon={FiMoreHorizontal}
          items={moreMenuItems}
          compactLabel
        />

        {/* ── Divider ──────────── */}
        <div className="mx-0.5 hidden h-5 w-px bg-surface-muted/60 sm:block" aria-hidden="true" />

        {/* ── Workflow CTA ─────── */}
        {canComplete ? (
          <button
            onClick={handleComplete}
            disabled={completeMutation.isPending || Boolean(completionBlockedReason)}
            className={COMPACT_BTN_SUCCESS}
            title={completionBlockedReason ?? undefined}
          >
            <FiCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Finalizar</span>
          </button>
        ) : null}

        {canSign ? (
          <button
            onClick={() => setShowSignModal(true)}
            disabled={signMutation.isPending}
            className={COMPACT_BTN_PRIMARY}
          >
            <FiShield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Firmar</span>
          </button>
        ) : null}
      </div>
    );
  }, [
    encounter,
    sections.length,
    completedCount,
    canEdit,
    saveStateLabel,
    saveStateToneClass,
    saveStatus,
    hasUnsavedChanges,
    saveSectionMutation.isPending,
    saveCurrentSection,
    handleViewFicha,
    drawerShortcutHint,
    isDrawerOpen,
    setIsDrawerOpen,
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
