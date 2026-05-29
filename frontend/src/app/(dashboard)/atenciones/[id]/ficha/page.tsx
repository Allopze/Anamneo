'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { FiShield } from 'react-icons/fi';
import SignEncounterModal from '@/components/common/SignEncounterModal';
import AttachmentPreviewModal from '@/components/common/AttachmentPreviewModal';
import PdfPreviewModal from '@/components/common/PdfPreviewModal';
import ReopenEncounterModal from '@/components/common/ReopenEncounterModal';
import { useFichaClinica } from './useFichaClinica';
import { FichaToolbar } from './FichaToolbar';
import { fallbackPdfFilename } from './ficha.constants';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import {
  FichaClinicalAlerts,
  FichaClinicalRecord,
  FichaSignaturePanel,
} from './FichaContentBlocks';

function FichaClinicaSkeleton() {
  return (
    <div className="min-h-screen bg-surface-base p-4" aria-busy="true" aria-label="Cargando ficha clínica">
      <div className="mb-5 h-16 rounded-card bg-surface-elevated shadow-soft" />
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-24 rounded-card bg-surface-elevated shadow-soft" />
        <div className="rounded-card border border-surface-muted/35 bg-surface-elevated p-5">
          <div className="mb-4 h-7 w-56 skeleton" />
          <div className="space-y-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-12 w-full skeleton" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FichaClinicaPage() {
  const {
    id,
    encounter,
    isLoading,
    isOperationalAdmin,
    canSign,
    canReopen,
    canDuplicateEncounter,
    clinicalOutputBlock,
    focusedDocumentBlockedReason,
    pdfBlockedReason,
    printBlockedReason,
    patientOutputBlockReason,
    fullRecordBlockedReason,
    showSignModal,
    setShowSignModal,
    showReopenModal,
    setShowReopenModal,
    previewAttachment,
    setPreviewAttachment,
    signMutation,
    reopenMutation,
    duplicateEncounterMutation,
    handlePrint,
    handleDownloadAttachment,
    handleDownloadDocument,
    handleDownloadPdf,
    previewKind,
    openPreview,
    closePreview,
    sectionData,
    patientCompletenessMeta,
    linkedAttachmentsByOrderId,
    signatureSummary,
    signatureDiff,
    handleDuplicateEncounter,
  } = useFichaClinica();

  // Stable callbacks to open modals — avoid recreating inline handlers
  // on every render which can cause upstream slots to remount.
  const openSignModal = useCallback(() => setShowSignModal(true), [setShowSignModal]);
  const openReopenModal = useCallback(() => setShowReopenModal(true), [setShowReopenModal]);

  if (isOperationalAdmin) {
    return (
      <RouteAccessGate
        when={true}
        title="Redirigiendo…"
        description="Esta vista clínica no está disponible para tu perfil. Te llevamos al inicio."
        href="/"
        actionLabel="Ir al inicio"
      />
    );
  }

  if (isLoading) {
    return <FichaClinicaSkeleton />;
  }

  if (!encounter) {
    return (
      <div className="text-center py-12">
        <p>Atención no encontrada</p>
      </div>
    );
  }

  return (
    <>
      <FichaToolbar
        id={id}
        encounter={encounter}
        canSign={canSign}
        canReopen={canReopen}
        canDuplicate={canDuplicateEncounter}
        focusedDocumentBlockedReason={focusedDocumentBlockedReason}
        pdfBlockedReason={pdfBlockedReason}
        printBlockedReason={printBlockedReason}
        signIsPending={signMutation.isPending}
        reopenIsPending={reopenMutation.isPending}
        duplicateIsPending={duplicateEncounterMutation.isPending}
        onDownloadDocument={handleDownloadDocument}
        onDownloadPdf={handleDownloadPdf}
        onPreviewDocument={openPreview}
        onPrint={handlePrint}
        onSign={openSignModal}
        onReopen={openReopenModal}
        onDuplicate={handleDuplicateEncounter}
      />

      <FichaClinicalAlerts
        patientId={encounter.patientId}
        patientOutputBlockReason={patientOutputBlockReason}
        fullRecordBlockedReason={fullRecordBlockedReason}
      />

      {(canSign || canReopen) && (
        <FichaSignaturePanel
          encounter={encounter}
          canSign={canSign}
          signIsPending={signMutation.isPending}
          onSign={() => setShowSignModal(true)}
          signatureSummary={signatureSummary}
          signatureDiff={signatureDiff}
        />
      )}
      <FichaClinicalRecord
        encounter={encounter}
        clinicalOutputBlock={clinicalOutputBlock}
        patientCompletenessMeta={patientCompletenessMeta}
        sectionData={sectionData}
        linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
        onPreviewAttachment={setPreviewAttachment}
        onDownloadAttachment={handleDownloadAttachment}
      />

      <SignEncounterModal
        open={showSignModal}
        loading={signMutation.isPending}
        onConfirm={(password) => signMutation.mutate(password)}
        onClose={() => setShowSignModal(false)}
      />

      <ReopenEncounterModal
        open={showReopenModal}
        loading={reopenMutation.isPending}
        onConfirm={(payload) => reopenMutation.mutate(payload)}
        onClose={() => setShowReopenModal(false)}
      />

      <AttachmentPreviewModal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
      />

      <PdfPreviewModal
        isOpen={previewKind !== null}
        onClose={closePreview}
        endpoint={
          previewKind === 'pdf'
            ? `/encounters/${id}/export/pdf`
            : `/encounters/${id}/export/document/${previewKind ?? 'receta'}`
        }
        fallbackFilename={previewKind ? fallbackPdfFilename(encounter, previewKind) : ''}
        title={
          previewKind === 'pdf' ? 'PDF completo' :
          previewKind === 'receta' ? 'Receta' :
          previewKind === 'ordenes' ? 'Órdenes' :
          previewKind === 'derivacion' ? 'Derivación' : ''
        }
      />
    </>
  );
}
