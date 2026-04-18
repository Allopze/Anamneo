'use client';

import Link from 'next/link';
import clsx from 'clsx';
import {
  FiAlertCircle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiSlash,
} from 'react-icons/fi';

import ClinicalAlerts from '@/components/ClinicalAlerts';
import TemplateSelector from '@/components/TemplateSelector';
import ConfirmModal from '@/components/common/ConfirmModal';
import SignEncounterModal from '@/components/common/SignEncounterModal';
import AttachmentPreviewModal from '@/components/common/AttachmentPreviewModal';
import EncounterDrawer from '@/components/EncounterDrawer';
import type { SectionKey } from '@/types';
import { getErrorMessage } from '@/lib/api';

import { useEncounterWizard } from './useEncounterWizard';
import { setEncounterDrawerOpen, setEncounterDrawerTab } from './encounter-drawer-state';
import {
  SURFACE_PANEL_CLASS,
  TOOLBAR_BUTTON_CLASS,
  TOOLBAR_PRIMARY_BUTTON_CLASS,
  SECTION_STATUS_META,
  REQUIRED_SEMANTIC_SECTIONS,
} from './encounter-wizard.constants';
import EncounterHeader from './EncounterHeader';
import EncounterSectionRail from './EncounterSectionRail';
import EncounterAttachmentsModal from './EncounterAttachmentsModal';

export default function EncounterWizardPage() {
  const wiz = useEncounterWizard();

  if (wiz.isOperationalAdmin) return null;

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

      {/* Clinical warnings banner */}
      {(wiz.identificationMissingFields.length > 0 ||
        Boolean(encounter.patient?.completenessStatus && encounter.patient.completenessStatus !== 'VERIFICADA') ||
        Boolean(wiz.clinicalOutputBlockReason)) && (
        <div className="px-4 pt-4 lg:px-8 xl:px-10">
          <div className="rounded-card border border-surface-muted/40 bg-surface-base p-4 text-sm text-ink-secondary">
            {wiz.identificationMissingFields.length > 0 ? (
              <p>La identificación de esta atención sigue incompleta. Faltan: {wiz.identificationMissingFields.join(', ')}.</p>
            ) : null}
            {wiz.patientCompletenessMeta &&
            encounter.patient?.completenessStatus &&
            encounter.patient.completenessStatus !== 'VERIFICADA' ? (
              <p className={wiz.identificationMissingFields.length > 0 ? 'mt-2' : ''}>
                La ficha maestra del paciente está en estado &ldquo;{wiz.patientCompletenessMeta.label.toLowerCase()}&rdquo;.
              </p>
            ) : null}
            {wiz.clinicalOutputBlockReason ? (
              <>
                <p
                  className={
                    wiz.identificationMissingFields.length > 0 ||
                    Boolean(encounter.patient?.completenessStatus && encounter.patient.completenessStatus !== 'VERIFICADA')
                      ? 'mt-2'
                      : ''
                  }
                >
                  {wiz.clinicalOutputBlockReason}
                </p>
                <Link
                  href={`/pacientes/${encounter.patientId}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-surface-muted px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-muted/50 hover:text-ink"
                >
                  Revisar ficha administrativa
                </Link>
              </>
            ) : null}
          </div>
        </div>
      )}

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
            {/* Mobile section pills */}
            <div className="xl:hidden">
              <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sidebar-scroll" aria-label="Secciones">
                {sections.map((section, index) => {
                  const state = wiz.getSectionUiState(section);
                  const meta = SECTION_STATUS_META[state];
                  const isActive = index === currentSectionIndex;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => wiz.moveToSection(index)}
                      className={clsx(
                        'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-accent/40 bg-accent/10 text-ink'
                          : 'border-surface-muted/45 bg-surface-elevated text-ink-secondary hover:border-accent/30 hover:text-ink',
                      )}
                    >
                      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dotClassName)} />
                      <span className="whitespace-nowrap">
                        {index + 1}. {section.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {encounter.patientId ? <ClinicalAlerts patientId={encounter.patientId} variant="workspace-sticky" /> : null}

            {/* Active section panel */}
            <section className={SURFACE_PANEL_CLASS}>
              <div className="border-b border-surface-muted/40 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
                      <span>
                        Sección {currentSectionIndex + 1} de {sections.length}
                      </span>
                      {!(wiz.currentSectionStatusMeta as any).hidden && (
                        <span className={clsx('flex items-center gap-2', wiz.currentSectionStatusMeta.badgeClassName)}>
                          <span className={clsx('h-1.5 w-1.5 rounded-full', wiz.currentSectionStatusMeta.dotClassName)} />
                          {wiz.currentSectionStatusMeta.label}
                        </span>
                      )}
                      {wiz.isSectionSwitchPending ? <span>Cambiando sección…</span> : null}
                    </div>
                    <h2 className="mt-2 text-[1.7rem] font-extrabold tracking-tight text-ink">
                      {currentSection?.label}
                    </h2>
                  </div>

                  {wiz.canEdit && wiz.supportsTemplates && currentSection ? (
                    <TemplateSelector
                      sectionKey={currentSection.sectionKey}
                      onInsert={wiz.insertTemplateIntoCurrentSection}
                    />
                  ) : null}
                </div>
              </div>

              <div className="px-5 py-5 sm:px-6">
                <div className="mx-auto max-w-4xl">
                  {SectionComponent ? (
                    <SectionComponent
                      data={formData[currentSection.sectionKey] || {}}
                      onChange={(data: any) => wiz.handleSectionDataChange(currentSection.sectionKey, data)}
                      encounter={encounter}
                      readOnly={!wiz.canEdit || currentSection.sectionKey === 'IDENTIFICACION'}
                      snapshotStatus={
                        currentSection.sectionKey === 'IDENTIFICACION' ? wiz.identificationSnapshotStatus : undefined
                      }
                      onRestoreFromPatient={
                        currentSection.sectionKey === 'IDENTIFICACION' && wiz.canEdit
                          ? wiz.handleRestoreIdentificationFromPatient
                          : undefined
                      }
                      patientId={encounter.patientId}
                      canEditPatientHistory={wiz.canEditAntecedentes()}
                      linkedAttachmentsByOrderId={wiz.linkedAttachmentsByOrderId}
                      onRequestAttachToOrder={wiz.handleStartLinkedAttachment}
                      onPreviewAttachment={wiz.setPreviewAttachment}
                      patientAge={wiz.identificationData.edad ?? encounter.patient?.edad}
                      patientAgeMonths={wiz.identificationData.edadMeses ?? encounter.patient?.edadMeses}
                      patientSexo={wiz.identificationData.sexo ?? encounter.patient?.sexo}
                      motivoConsultaData={
                        currentSection.sectionKey === 'SOSPECHA_DIAGNOSTICA'
                          ? (formData.MOTIVO_CONSULTA ??
                            encounter?.sections?.find((s) => s.sectionKey === 'MOTIVO_CONSULTA')?.data)
                          : undefined
                      }
                      allergyData={
                        currentSection.sectionKey === 'TRATAMIENTO'
                          ? (formData.ANAMNESIS_REMOTA?.alergias ??
                            encounter?.sections?.find((s) => s.sectionKey === 'ANAMNESIS_REMOTA')?.data?.alergias)
                          : undefined
                      }
                    />
                  ) : (
                    <div className="rounded-card border border-surface-muted/40 bg-surface-base/55 px-5 py-5 text-sm text-ink-secondary">
                      No hay una sección activa para mostrar.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-frame/12 bg-surface-base/25 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => wiz.handleNavigate('prev')}
                    disabled={currentSectionIndex === 0}
                    className={TOOLBAR_BUTTON_CLASS}
                  >
                    <FiChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {wiz.canEdit &&
                    currentSection?.sectionKey !== 'IDENTIFICACION' &&
                    !REQUIRED_SEMANTIC_SECTIONS.includes(currentSection?.sectionKey as SectionKey) ? (
                      <button
                        onClick={wiz.handleMarkNotApplicable}
                        disabled={
                          wiz.saveSectionMutation.isPending ||
                          currentSection?.completed ||
                          currentSection?.notApplicable
                        }
                        className={TOOLBAR_BUTTON_CLASS}
                        title="Marcar esta sección como no aplica para este paciente"
                      >
                        <FiSlash className="h-4 w-4" />
                        No aplica
                      </button>
                    ) : null}

                    {currentSectionIndex < sections.length - 1 ? (
                      <button onClick={() => wiz.handleNavigate('next')} className={TOOLBAR_PRIMARY_BUTTON_CLASS}>
                        Siguiente
                        <FiChevronRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          currentSection && wiz.persistSection({ sectionKey: currentSection.sectionKey, completed: true })
                        }
                        disabled={wiz.saveSectionMutation.isPending || currentSection?.completed || !wiz.canEdit}
                        className={TOOLBAR_PRIMARY_BUTTON_CLASS}
                        title="Marcar como completa y guardar los últimos cambios"
                      >
                        Completar
                        <FiCheck className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Attachments modal */}
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

      {/* Modals */}
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

      {wiz.showNotApplicableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-card border border-surface-muted bg-surface-base p-6 shadow-lg">
            <h3 className="text-base font-semibold text-ink">Marcar sección como &ldquo;No aplica&rdquo;</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Indique el motivo por el que esta sección no aplica para este paciente (mínimo 10 caracteres).
            </p>
            <textarea
              value={wiz.notApplicableReason}
              onChange={(e) => wiz.setNotApplicableReason(e.target.value)}
              className="form-input mt-3 min-h-[80px] w-full resize-y"
              placeholder="Ej: Paciente pediátrico, no corresponde revisión de sistemas…"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => wiz.setShowNotApplicableModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={wiz.handleConfirmNotApplicable}
                disabled={wiz.notApplicableReason.trim().length < 10 || wiz.saveSectionMutation.isPending}
                className="btn btn-primary"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

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
