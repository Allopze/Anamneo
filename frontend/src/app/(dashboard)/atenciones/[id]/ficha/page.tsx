'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { FiShield } from 'react-icons/fi';
import SignEncounterModal from '@/components/common/SignEncounterModal';
import AttachmentPreviewModal from '@/components/common/AttachmentPreviewModal';
import ReopenEncounterModal from '@/components/common/ReopenEncounterModal';
import { useFichaClinica } from './useFichaClinica';
import { FichaToolbar } from './FichaToolbar';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import {
  FichaClinicalAlerts,
  FichaClinicalRecord,
  FichaSignaturePanel,
} from './FichaContentBlocks';

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent" />
      </div>
    );
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
    </>
  );
}
