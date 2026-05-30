import { FiX, FiTrash2 } from 'react-icons/fi';
import type { EncounterWizardHook } from './useEncounterWizard';
import { AttachmentUploadForm, AttachmentList } from './EncounterAttachmentsModal.parts';

type Props = Pick<
  EncounterWizardHook,
  | 'canUpload'
  | 'canDeleteAttachments'
  | 'selectedFile'
  | 'setSelectedFile'
  | 'uploadError'
  | 'setUploadError'
  | 'uploadMeta'
  | 'setUploadMeta'
  | 'attachments'
  | 'attachmentsQuery'
  | 'currentLinkedOrderType'
  | 'currentLinkableOrders'
  | 'uploadMutation'
  | 'deleteMutation'
  | 'handleDownload'
  | 'setIsAttachmentsOpen'
  | 'showDeleteAttachment'
  | 'setShowDeleteAttachment'
  | 'setPreviewAttachment'
>;

export default function EncounterAttachmentsModal({
  canUpload,
  canDeleteAttachments,
  selectedFile,
  setSelectedFile,
  uploadError,
  setUploadError,
  uploadMeta,
  setUploadMeta,
  attachments,
  attachmentsQuery,
  currentLinkedOrderType,
  currentLinkableOrders,
  uploadMutation,
  deleteMutation,
  handleDownload,
  setIsAttachmentsOpen,
  showDeleteAttachment,
  setShowDeleteAttachment,
}: Props) {
  const attachmentPendingDeletion = showDeleteAttachment
    ? attachments.find((attachment) => attachment.id === showDeleteAttachment) ?? null
    : null;

  const closeModal = () => {
    setShowDeleteAttachment(null);
    setIsAttachmentsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-[1px]" onClick={closeModal} />
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-dropdown"
        role="dialog"
        aria-modal="true"
        aria-label="Adjuntos de la atención"
      >
        <div className="flex items-start justify-between gap-3 border-b border-surface-muted/35 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Adjuntos de la Atención</h2>
            <p className="text-sm text-ink-secondary">
              Archivos cargados y documentos vinculados a esta atención.
            </p>
          </div>
          <button
            className="toolbar-btn"
            onClick={closeModal}
            aria-label="Cerrar adjuntos"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {attachmentPendingDeletion ? (
            <div className="mb-5 rounded-card border border-status-red/30 bg-status-red/10 p-4">
              <p className="text-sm font-medium text-status-red-text">
                Vas a eliminar {attachmentPendingDeletion.originalName}.
              </p>
              <p className="mt-1 text-sm text-ink-secondary">
                El archivo dejará de ser visible y se eliminará del disco tras 30 días. Si fue un clic accidental, cancélalo ahora.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteAttachment(null)}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-input bg-status-red px-4 py-3 text-sm font-medium text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-red/35 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => deleteMutation.mutate(attachmentPendingDeletion.id)}
                  disabled={deleteMutation.isPending}
                >
                  <FiTrash2 className="h-4 w-4" />
                  {deleteMutation.isPending ? 'Eliminando…' : 'Confirmar eliminación'}
                </button>
              </div>
            </div>
          ) : null}

          {canUpload && (
            <AttachmentUploadForm
              selectedFile={selectedFile}
              uploadError={uploadError}
              uploadMeta={uploadMeta}
              currentLinkedOrderType={currentLinkedOrderType}
              currentLinkableOrders={currentLinkableOrders}
              isPending={uploadMutation.isPending}
              setSelectedFile={setSelectedFile}
              setUploadError={setUploadError}
              setUploadMeta={setUploadMeta}
              onSubmit={(file) => uploadMutation.mutate(file)}
            />
          )}

          {uploadError && <p className="mt-4 text-sm text-status-red-text">{uploadError}</p>}

          <div className="mt-5">
            {attachmentsQuery.isLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-10 skeleton rounded-card" />
                ))}
              </div>
            ) : attachmentsQuery.error ? (
              <div className="rounded-card border border-surface-muted/35 p-4 text-sm text-status-red-text">
                {String((attachmentsQuery.error as any)?.message ?? 'Error al cargar adjuntos')}
              </div>
            ) : (
              <AttachmentList
                attachments={attachments}
                canDelete={canDeleteAttachments}
                onDeleteClick={(attachmentId) => setShowDeleteAttachment(attachmentId)}
                onDownload={handleDownload}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
