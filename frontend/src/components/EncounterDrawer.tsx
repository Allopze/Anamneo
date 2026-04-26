'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import clsx from 'clsx';

import { REVIEW_STATUS_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import EncounterAuditTimeline from '@/components/EncounterAuditTimeline';
import {
  INNER_PANEL_CLASS,
  SIDEBAR_TABS,
  type EncounterDrawerProps,
} from './encounter-drawer.constants';
import { CloseTabPanel, ReviewTabPanel, SupportTabPanel } from './EncounterDrawerPanels';

export type { SidebarTabKey } from './encounter-drawer.constants';

export default function EncounterDrawer(props: EncounterDrawerProps) {
  const {
    open,
    onClose,
    tab,
    onTabChange,
    encounter,
    canEdit,
    canComplete,
    canRequestMedicalReview,
    canMarkReviewedByDoctor,
    canWriteReviewNote,
    canViewAudit,
    canCreateFollowupTask,
    reviewActionNote,
    onReviewActionNoteChange,
    onReviewStatusChange,
    reviewStatusPending,
    generatedSummary,
    onSaveGeneratedSummary,
    quickNotesValue,
    quickNotesDisabled,
    quickNotesSaving,
    onQuickNotesSave,
    onOpenAttachments,
    canEditAntecedentes,
    quickTask,
    onQuickTaskChange,
    onCreateTask,
    createTaskPending,
    closureNote,
    onClosureNoteChange,
    completionChecklist,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const visibleTabs = canViewAudit ? SIDEBAR_TABS : SIDEBAR_TABS.filter((tabItem) => tabItem.key !== 'historial');
  const completionReadyCount = completionChecklist.filter((item) => item.status === 'ready').length;

  /* mount → animate in */
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Force a layout read so the transition fires
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  /* Escape key */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  /* Focus trap — cycle Tab within panel */
  useEffect(() => {
    if (!visible || !panelRef.current) return;
    panelRef.current.focus();

    const panel = panelRef.current;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    panel.addEventListener('keydown', handleTab);
    return () => panel.removeEventListener('keydown', handleTab);
  }, [visible]);

  if (!mounted) return null;

  const drawer = (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog" aria-label="Panel lateral de la atención">
      {/* Backdrop */}
      <div
        className={clsx(
          'absolute inset-0 bg-ink/40 backdrop-blur-[1px] transition-opacity duration-250',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={clsx(
          'relative flex h-full w-full max-w-[420px] flex-col bg-surface-elevated shadow-dropdown transition-transform duration-250 ease-out focus:outline-none',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header with close + tabs */}
        <div className="flex items-center justify-between border-b border-surface-muted/40 px-4 py-2">
          <div className="flex flex-1 gap-0">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onTabChange(t.key)}
                className={clsx(
                  'flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors',
                  tab === t.key ? 'border-b-2 border-accent text-ink' : 'text-ink-secondary hover:text-ink',
                )}
              >
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">{t.label}</span>
                <span className="sm:hidden truncate">{t.shortLabel}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex size-9 shrink-0 items-center justify-center rounded-input text-ink-secondary transition-colors hover:bg-surface-muted/30 hover:text-ink"
            aria-label="Cerrar panel"
          >
            <FiX className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {tab === 'revision' && (
            <ReviewTabPanel
              encounter={encounter}
              canEdit={canEdit}
              canRequestMedicalReview={canRequestMedicalReview}
              canMarkReviewedByDoctor={canMarkReviewedByDoctor}
              canWriteReviewNote={canWriteReviewNote}
              reviewActionNote={reviewActionNote}
              onReviewActionNoteChange={onReviewActionNoteChange}
              onReviewStatusChange={onReviewStatusChange}
              reviewStatusPending={reviewStatusPending}
              generatedSummary={generatedSummary}
              onSaveGeneratedSummary={onSaveGeneratedSummary}
            />
          )}

          {tab === 'apoyo' && (
            <SupportTabPanel
              encounter={encounter}
              quickNotesValue={quickNotesValue}
              quickNotesDisabled={quickNotesDisabled}
              quickNotesSaving={quickNotesSaving}
              onQuickNotesSave={onQuickNotesSave}
              onOpenAttachments={onOpenAttachments}
              canEditAntecedentes={canEditAntecedentes}
              quickTask={quickTask}
              onQuickTaskChange={onQuickTaskChange}
              onCreateTask={onCreateTask}
              createTaskPending={createTaskPending}
              canCreateFollowupTask={canCreateFollowupTask}
            />
          )}

          {tab === 'cierre' && (
            <CloseTabPanel
              encounter={encounter}
              canComplete={canComplete}
              closureNote={closureNote}
              onClosureNoteChange={onClosureNoteChange}
              completionChecklist={completionChecklist}
              generatedSummary={generatedSummary}
            />
          )}

          {tab === 'historial' && canViewAudit ? <EncounterAuditTimeline encounterId={encounter.id} /> : null}
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
