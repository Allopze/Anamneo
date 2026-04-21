'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { FiAlertCircle } from 'react-icons/fi';

import ClinicalAlerts from '@/components/ClinicalAlerts';
import ConfirmModal from '@/components/common/ConfirmModal';
import SignEncounterModal from '@/components/common/SignEncounterModal';
import AttachmentPreviewModal from '@/components/common/AttachmentPreviewModal';
import EncounterDrawer from '@/components/EncounterDrawer';
import { getErrorMessage } from '@/lib/api';

import { useEncounterWizard } from './useEncounterWizard';
import { setEncounterDrawerOpen, setEncounterDrawerTab } from './encounter-drawer-state';
import EncounterHeader from './EncounterHeader';
import EncounterSectionRail from './EncounterSectionRail';
import EncounterAttachmentsModal from './EncounterAttachmentsModal';
import EncounterRecoveryPanel from './EncounterRecoveryPanel';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { NotApplicableModal } from './NotApplicableModal';
import EncounterClinicalWarnings from './EncounterClinicalWarnings';
import EncounterMobileSectionNav from './EncounterMobileSectionNav';
import EncounterActiveSectionCard from './EncounterActiveSectionCard';

export default function EncounterWizardPage() {
  const wiz = useEncounterWizard();

  if (wiz.isOperationalAdmin) {
    return (
      <RouteAccessGate
        when={true}
        title="Redirigiendo…"
        description="La edición clínica de atenciones no está disponible para tu perfil."
        href="/"
        actionLabel="Ir al inicio"
      />
    );
  }

  if (wiz.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (wiz.error || !wiz.encounter) {
    const msg = wiz.error ? getErrorMessage(wiz.error) : null;
    return (
      <div className="text-center py-12">
        <FiAlertCircle className="mx-auto mb-4 h-12 w-12 text-status-red" />
        <h2 className="mb-2 text-xl font-bold text-ink">Atención no encontrada</h2>
        {msg ? <p className="mb-4 whitespace-pre-line text-sm text-ink-muted">{msg}</p> : null}
        <Link href="/pacientes" className="btn btn-primary">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  const { encounter, sections, currentSection, currentSectionIndex, SectionComponent, formData } = wiz;
  const sectionLabelByKey = Object.fromEntries(sections.map((section) => [section.sectionKey, section.label]));
  const conflictSectionIndex = wiz.recoverableConflict
    ? sections.findIndex((section) => section.sectionKey === wiz.recoverableConflict?.sectionKey)
    : -1;
  const isViewingConflictSection = currentSection?.sectionKey === wiz.recoverableConflict?.sectionKey;

  return (
    <div className="min-h-screen overflow-x-clip bg-surface-base">
      <EncounterHeader
        encounter={encounter}
        sections={sections}
        completedCount={wiz.completedCount}
        progressPercentage={wiz.progressPercentage}
        elapsedMinutes={wiz.elapsedMinutes}
        isOnline={wiz.isOnline}
        pendingSaveCount={wiz.pendingSaveCount}
        canEdit={wiz.canEdit}
        canDuplicateEncounter={wiz.canDuplicateEncounter}
        canComplete={wiz.canComplete}
        canSign={wiz.canSign}
        hasUnsavedChanges={wiz.hasUnsavedChanges}
        saveStatus={wiz.saveStatus}
        saveStateLabel={wiz.saveStateLabel}
        saveStateToneClass={wiz.saveStateToneClass}
        drawerShortcutHint={wiz.drawerShortcutHint}
        isDrawerOpen={wiz.isDrawerOpen}
        setIsDrawerOpen={wiz.setIsDrawerOpen}
        completionBlockedReason={wiz.completionBlockedReason}
        saveCurrentSection={wiz.saveCurrentSection}
        handleDuplicateEncounter={wiz.handleDuplicateEncounter}
        handleComplete={wiz.handleComplete}
        handleViewFicha={wiz.handleViewFicha}
        openDrawerTab={wiz.openDrawerTab}
        saveSectionMutation={wiz.saveSectionMutation}
        duplicateEncounterMutation={wiz.duplicateEncounterMutation}
        completeMutation={wiz.completeMutation}
        signMutation={wiz.signMutation}
        setShowSignModal={wiz.setShowSignModal}
      />

      <EncounterClinicalWarnings
        identificationMissingFields={wiz.identificationMissingFields}
        patientCompletenessMeta={wiz.patientCompletenessMeta}
        patientCompletenessStatus={encounter.patient?.completenessStatus}
        clinicalOutputBlockReason={wiz.clinicalOutputBlockReason}
        patientId={encounter.patientId}
      />

      <div
        className={clsx(
          'grid w-full gap-5 px-4 py-5 xl:items-start xl:px-6 xl:py-6 2xl:px-10',
          wiz.railCollapsed ? 'xl:grid-cols-[64px_minmax(0,1fr)]' : 'xl:grid-cols-[264px_minmax(0,1fr)]',
        )}
      >
        <EncounterSectionRail
          sections={sections}
          currentSectionIndex={currentSectionIndex}
          railCollapsed={wiz.railCollapsed}
          setRailCollapsed={wiz.setRailCollapsed}
          railCompletedCollapsed={wiz.railCompletedCollapsed}
          setRailCompletedCollapsed={wiz.setRailCompletedCollapsed}
          getSectionUiState={wiz.getSectionUiState}
          moveToSection={wiz.moveToSection}
        />

        <main className="min-w-0">
          <div className="mx-auto flex max-w-5xl flex-col gap-5">
            <EncounterMobileSectionNav
              sections={sections}
              currentSectionIndex={currentSectionIndex}
              getSectionUiState={wiz.getSectionUiState}
              moveToSection={wiz.moveToSection}
            />

            {encounter.patientId ? <ClinicalAlerts patientId={encounter.patientId} variant="workspace-sticky" /> : null}

            {wiz.localDraft || wiz.recoverableConflicts.length > 0 ? (
              <EncounterRecoveryPanel
                currentSectionKey={currentSection?.sectionKey}
                currentSectionIndex={currentSectionIndex}
                localDraft={wiz.localDraft}
                recoverableConflicts={wiz.recoverableConflicts}
                sectionLabelByKey={sectionLabelByKey}
                moveToSection={wiz.moveToSection}
                getSectionIndex={(sectionKey) => sections.findIndex((section) => section.sectionKey === sectionKey)}
                onRestoreConflict={wiz.handleRestoreRecoverableConflict}
                onDismissConflict={wiz.handleDismissRecoverableConflict}
              />
            ) : null}

            {wiz.recoverableConflict ? (
              <section className="rounded-card border border-amber-300/80 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">La copia local quedó protegida y lista para comparar.</p>
                    <p>
                      La sección <strong>{sections[conflictSectionIndex]?.label ?? wiz.recoverableConflict.sectionKey}</strong>{' '}
                      ya fue recargada con la versión del servidor. Puedes restaurar tu texto desde el panel de
                      recuperación o seguir revisando la versión vigente.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isViewingConflictSection ? (
                      <button
                        type="button"
                        onClick={() => wiz.handleRestoreRecoverableConflict(wiz.recoverableConflict?.sectionKey)}
                        className="rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
                      >
                        Restaurar mi copia local
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (conflictSectionIndex >= 0) {
                            wiz.moveToSection(conflictSectionIndex);
                          }
                        }}
                        className="rounded-full border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100"
                      >
                        Ir a la sección en conflicto
                      </button>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <EncounterActiveSectionCard
              wiz={wiz}
              encounter={encounter}
              sections={sections}
              currentSection={currentSection}
              currentSectionIndex={currentSectionIndex}
              SectionComponent={SectionComponent}
              formData={formData}
            />
          </div>
        </main>
      </div>
      {wiz.isAttachmentsOpen && (
        <EncounterAttachmentsModal
          canUpload={wiz.canUpload}
          canDeleteAttachments={wiz.canDeleteAttachments}
          selectedFile={wiz.selectedFile}
          setSelectedFile={wiz.setSelectedFile}
          uploadError={wiz.uploadError}
          setUploadError={wiz.setUploadError}
          uploadMeta={wiz.uploadMeta}
          setUploadMeta={wiz.setUploadMeta}
          attachments={wiz.attachments}
          attachmentsQuery={wiz.attachmentsQuery}
          currentLinkedOrderType={wiz.currentLinkedOrderType}
          currentLinkableOrders={wiz.currentLinkableOrders}
          uploadMutation={wiz.uploadMutation}
          deleteMutation={wiz.deleteMutation}
          handleDownload={wiz.handleDownload}
          setIsAttachmentsOpen={wiz.setIsAttachmentsOpen}
          showDeleteAttachment={wiz.showDeleteAttachment}
          setShowDeleteAttachment={wiz.setShowDeleteAttachment}
          setPreviewAttachment={wiz.setPreviewAttachment}
        />
      )}
      <ConfirmModal
        isOpen={wiz.showCompleteConfirm}
        onClose={() => wiz.setShowCompleteConfirm(false)}
        onConfirm={wiz.confirmComplete}
        title="Finalizar atención"
        message="¿Estás seguro de finalizar esta atención? Una vez finalizada, las secciones no podrán editarse."
        confirmLabel="Finalizar atención"
        variant="warning"
        loading={wiz.completeMutation.isPending}
      />

      <SignEncounterModal
        open={wiz.showSignModal}
        loading={wiz.signMutation.isPending}
        onConfirm={(password) => wiz.signMutation.mutate(password)}
        onClose={() => wiz.setShowSignModal(false)}
      />
      <AttachmentPreviewModal
        isOpen={!!wiz.previewAttachment}
        onClose={() => wiz.setPreviewAttachment(null)}
        attachment={wiz.previewAttachment}
      />

      <NotApplicableModal
        isOpen={wiz.showNotApplicableModal}
        reason={wiz.notApplicableReason}
        isSaving={wiz.saveSectionMutation.isPending}
        onReasonChange={wiz.setNotApplicableReason}
        onClose={() => wiz.setShowNotApplicableModal(false)}
        onConfirm={wiz.handleConfirmNotApplicable}
      />

      <EncounterDrawer
        open={wiz.isDrawerOpen}
        onClose={() => {
          wiz.setIsDrawerOpen(false);
          setEncounterDrawerOpen(false);
        }}
        tab={wiz.sidebarTab}
        onTabChange={(t) => {
          wiz.setSidebarTab(t);
          setEncounterDrawerTab(t);
        }}
        encounter={encounter}
        canEdit={wiz.canEdit}
        canComplete={wiz.canComplete}
        canRequestMedicalReview={wiz.canRequestMedicalReview}
        canMarkReviewedByDoctor={wiz.canMarkReviewedByDoctor}
        canWriteReviewNote={wiz.canWriteReviewNote}
        canViewAudit={wiz.canViewAudit}
        canCreateFollowupTask={wiz.canCreateFollowupTask}
        reviewActionNote={wiz.reviewActionNote}
        onReviewActionNoteChange={wiz.setReviewActionNote}
        onReviewStatusChange={wiz.handleReviewStatusChange}
        reviewStatusPending={wiz.reviewStatusMutation.isPending}
        generatedSummary={wiz.generatedSummary}
        onSaveGeneratedSummary={wiz.handleSaveGeneratedSummary}
        quickNotesValue={(wiz.formData.OBSERVACIONES as any)?.notasInternas || ''}
        quickNotesDisabled={!wiz.canEdit}
        quickNotesSaving={wiz.saveSectionMutation.isPending}
        onQuickNotesSave={wiz.handleQuickNotesSave}
        onOpenAttachments={() => wiz.setIsAttachmentsOpen(true)}
        canEditAntecedentes={wiz.canEditAntecedentes()}
        quickTask={wiz.quickTask}
        onQuickTaskChange={(t) => wiz.setQuickTask(t)}
        onCreateTask={wiz.handleCreateTask}
        createTaskPending={wiz.createTaskMutation.isPending}
        closureNote={wiz.closureNote}
        onClosureNoteChange={wiz.setClosureNote}
        completionChecklist={wiz.completionChecklist}
      />
    </div>
  );
}
