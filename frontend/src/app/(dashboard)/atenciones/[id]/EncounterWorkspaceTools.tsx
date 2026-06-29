'use client';

import { FiX } from 'react-icons/fi';
import EncounterAuditTimeline from '@/components/EncounterAuditTimeline';
import { CloseTabPanel, ReviewTabPanel, SupportTabPanel } from '@/components/EncounterWorkspacePanels';
import type { WorkspacePanelKey } from '@/components/encounter-workspace.constants';
import type { EncounterWizardHook } from './useEncounterWizard';

type WorkspacePanelProps = {
  activePanel: WorkspacePanelKey | null;
  onClose: () => void;
  wiz: EncounterWizardHook;
};

export function EncounterWorkspacePanel({ activePanel, onClose, wiz }: WorkspacePanelProps) {
  if (!activePanel || !wiz.encounter) {
    return null;
  }

  if (activePanel === 'historial' && !wiz.canViewAudit) {
    return null;
  }

  const titleByPanel: Record<WorkspacePanelKey, string> = {
    revision: 'Revisión',
    apoyo: 'Apoyo clínico',
    cierre: 'Cierre',
    historial: 'Historial',
  };

  return (
    <section className="overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-surface-muted/35 px-5 py-3 sm:px-6">
        <h2 className="text-sm font-semibold text-ink">{titleByPanel[activePanel]}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-input text-ink-secondary transition-colors hover:bg-surface-muted/30 hover:text-ink"
          aria-label={`Cerrar ${titleByPanel[activePanel].toLowerCase()}`}
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>

      {activePanel === 'revision' ? (
        <ReviewTabPanel
          encounter={wiz.encounter}
          canEdit={wiz.canEdit}
          canRequestMedicalReview={wiz.canRequestMedicalReview}
          canMarkReviewedByDoctor={wiz.canMarkReviewedByDoctor}
          canWriteReviewNote={wiz.canWriteReviewNote}
          reviewActionNote={wiz.reviewActionNote}
          onReviewActionNoteChange={wiz.setReviewActionNote}
          onReviewStatusChange={wiz.handleReviewStatusChange}
          reviewStatusPending={wiz.reviewStatusMutation.isPending}
          generatedSummary={wiz.generatedSummary}
          onSaveGeneratedSummary={wiz.handleSaveGeneratedSummary}
        />
      ) : null}

      {activePanel === 'apoyo' ? (
        <SupportTabPanel
          encounter={wiz.encounter}
          quickNotesValue={
            typeof wiz.formData.OBSERVACIONES === 'object' && wiz.formData.OBSERVACIONES !== null
              ? ((wiz.formData.OBSERVACIONES as { notasInternas?: string }).notasInternas ?? '')
              : ''
          }
          quickNotesDisabled={!wiz.canEdit}
          quickNotesSaving={wiz.saveSectionMutation.isPending}
          onQuickNotesSave={wiz.handleQuickNotesSave}
          onOpenAttachments={() => wiz.setIsAttachmentsOpen(true)}
          canEditAntecedentes={wiz.canEditAntecedentes}
          quickTask={wiz.quickTask}
          onQuickTaskChange={(task) => wiz.setQuickTask(task)}
          onCreateTask={wiz.handleCreateTask}
          createTaskPending={wiz.createTaskMutation.isPending}
          canCreateFollowupTask={wiz.canCreateFollowupTask}
        />
      ) : null}

      {activePanel === 'historial' && wiz.canViewAudit ? (
        <EncounterAuditTimeline encounterId={wiz.encounter.id} />
      ) : null}
    </section>
  );
}

export function EncounterClosureWorkspace({ wiz }: { wiz: EncounterWizardHook }) {
  if (!wiz.encounter || (!wiz.canComplete && !wiz.closureNote)) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-soft">
      <div className="border-b border-surface-muted/35 px-5 py-3 sm:px-6">
        <h2 className="text-sm font-semibold text-ink">Cierre</h2>
      </div>
      <CloseTabPanel
        encounter={wiz.encounter}
        canComplete={wiz.canComplete}
        closureNote={wiz.closureNote}
        onClosureNoteChange={wiz.setClosureNote}
        completionChecklist={wiz.completionChecklist}
        generatedSummary={wiz.generatedSummary}
      />
    </section>
  );
}
