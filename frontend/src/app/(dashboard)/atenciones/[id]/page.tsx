'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { FiAlertCircle, FiCalendar } from 'react-icons/fi';

import ConfirmModal from '@/components/common/ConfirmModal';
import SignEncounterModal from '@/components/common/SignEncounterModal';
import AttachmentPreviewModal from '@/components/common/AttachmentPreviewModal';
import { getErrorMessage } from '@/lib/api';
import ReassignmentCard from '@/components/ReassignmentCard';

import { useEncounterWizard } from './useEncounterWizard';
import EncounterHeader from './EncounterHeader';
import EncounterToolbar from './EncounterToolbar';
import EncounterSectionRail from './EncounterSectionRail';
import EncounterAttachmentsModal from './EncounterAttachmentsModal';
import EncounterRecoveryPanel from './EncounterRecoveryPanel';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { NotApplicableModal } from './NotApplicableModal';
import EncounterClinicalWarnings from './EncounterClinicalWarnings';
import EncounterMobileSectionNav from './EncounterMobileSectionNav';
import EncounterActiveSectionCard from './EncounterActiveSectionCard';
import EncounterClinicalSummaryCard from './EncounterClinicalSummaryCard';
import { EncounterClosureWorkspace, EncounterWorkspacePanel } from './EncounterWorkspaceTools';

export default function EncounterWizardPage() {
  const wiz = useEncounterWizard();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 's') {
        e.preventDefault();
        if (wiz.canEdit && wiz.hasUnsavedChanges) {
          void wiz.saveCurrentSection();
        }
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        wiz.handleNavigate('next');
        return;
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        wiz.handleNavigate('prev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wiz.canEdit, wiz.hasUnsavedChanges, wiz.saveCurrentSection, wiz.handleNavigate]);

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
      <EncounterToolbar
        encounter={encounter}
        canEdit={wiz.canEdit}
        canDuplicateEncounter={wiz.canDuplicateEncounter}
        canComplete={wiz.canComplete}
        canSign={wiz.canSign}
        hasUnsavedChanges={wiz.hasUnsavedChanges}
        saveStatus={wiz.saveStatus}
        saveStateLabel={wiz.saveStateLabel}
        canViewAudit={wiz.canViewAudit}
        completionBlockedReason={wiz.completionBlockedReason}
        saveCurrentSection={wiz.saveCurrentSection}
        handleDuplicateEncounter={wiz.handleDuplicateEncounter}
        handleComplete={wiz.handleComplete}
        handleViewFicha={wiz.handleViewFicha}
        openWorkspacePanel={wiz.openWorkspacePanel}
        saveSectionMutation={wiz.saveSectionMutation}
        duplicateEncounterMutation={wiz.duplicateEncounterMutation}
        completeMutation={wiz.completeMutation}
        signMutation={wiz.signMutation}
        setShowSignModal={wiz.setShowSignModal}
      />

      <EncounterHeader
        encounter={encounter}
        sections={sections}
        completedCount={wiz.completedCount}
        progressPercentage={wiz.progressPercentage}
        elapsedMinutes={wiz.elapsedMinutes}
        isOnline={wiz.isOnline}
        pendingSaveCount={wiz.pendingSaveCount}
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
          'grid w-full gap-5 px-4 py-5 xl:items-start xl:py-6 xl:pl-3 xl:pr-6 2xl:pl-4 2xl:pr-10 motion-safe:transition-[grid-template-columns] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none',
          wiz.railCollapsed ? 'xl:grid-cols-[72px_minmax(0,1fr)]' : 'xl:grid-cols-[264px_minmax(0,1fr)]',
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
          <div className="mx-auto flex max-w-7xl flex-col gap-5">
            <EncounterMobileSectionNav
              sections={sections}
              currentSectionIndex={currentSectionIndex}
              completedCount={wiz.completedCount}
              saveStateLabel={wiz.saveStateLabel}
              getSectionUiState={wiz.getSectionUiState}
              moveToSection={wiz.moveToSection}
            />

            {encounter.patientId ? (
              <EncounterClinicalSummaryCard patientId={encounter.patientId} patient={encounter.patient} />
            ) : null}

            {wiz.canReassign ? (
              <ReassignmentCard
                title="Reasignar atención"
                description="Transfiere esta atención junto a sus problemas y seguimientos asociados."
                endpoint={`/encounters/${wiz.id}/reassign`}
                allowClosedOverrideOption
                onSuccess={() => void wiz.handleReassignmentSuccess()}
              />
            ) : null}

            <EncounterWorkspacePanel
              activePanel={wiz.activeWorkspacePanel}
              onClose={() => wiz.setActiveWorkspacePanel(null)}
              wiz={wiz}
            />

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
                      La sección{' '}
                      <strong>{sections[conflictSectionIndex]?.label ?? wiz.recoverableConflict.sectionKey}</strong> ya
                      fue recargada con la versión del servidor. Puedes restaurar tu texto desde el panel de
                      recuperación o seguir revisando la versión vigente.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isViewingConflictSection ? (
                      <button
                        type="button"
                        onClick={() => wiz.handleRestoreRecoverableConflict(wiz.recoverableConflict?.sectionKey)}
                        className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
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
                        className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100"
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

            <EncounterClosureWorkspace wiz={wiz} />
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

      {wiz.followupSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="followup-modal-title">
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
              El diagnóstico <strong className="text-ink">{wiz.followupSuggestion.diagnosisText}</strong> sugiere un control en{' '}
              {wiz.followupSuggestion.days} días. ¿Deseas crear un seguimiento?
            </p>
            <div className="mb-5">
              <label className="form-label text-xs">Fecha del control</label>
              <input
                type="date"
                value={wiz.followupDate}
                onChange={(e) => wiz.setFollowupDate(e.target.value)}
                className="form-input mt-0.5"
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={wiz.handleFollowupSkip}
                disabled={wiz.createFollowupTaskMutation.isPending}
                className="btn btn-secondary text-sm"
              >
                Omitir
              </button>
              <button
                type="button"
                onClick={wiz.handleFollowupConfirm}
                disabled={wiz.createFollowupTaskMutation.isPending || !wiz.followupDate}
                className="btn btn-primary text-sm"
              >
                {wiz.createFollowupTaskMutation.isPending ? 'Creando…' : 'Crear control'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
