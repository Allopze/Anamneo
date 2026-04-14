import { FiX, FiDownload, FiTrash2 } from 'react-icons/fi';
import type { Attachment } from '@/types';
import type { EncounterWizardHook } from './useEncounterWizard';
import {
  TOOLBAR_BUTTON_CLASS,
  TOOLBAR_PRIMARY_BUTTON_CLASS,
  LINKABLE_ATTACHMENT_LABELS,
  formatDateTime,
  formatFileSize,
} from './encounter-wizard.constants';

type Props = Pick<
  EncounterWizardHook,
  | 'canUpload'
  | 'isDoctor'
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
  isDoctor,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/55 backdrop-blur-[1px]"
        onClick={() => {
          setShowDeleteAttachment(null);
          setIsAttachmentsOpen(false);
        }}
      />
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
            className={TOOLBAR_BUTTON_CLASS}
            onClick={() => {
              setShowDeleteAttachment(null);
              setIsAttachmentsOpen(false);
            }}
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
                Esta acción borra el archivo de la atención y del disco. Si fue un clic accidental, cancélalo ahora.
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedFile) {
                  setUploadError('Selecciona un archivo para subir');
                  return;
                }
                setUploadError(null);
                uploadMutation.mutate(selectedFile);
              }}
              className="flex flex-col gap-4 border-b border-surface-muted/35 pb-5"
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-3">
                  <div>
                    <label className="form-label" htmlFor="attachment-file">
                      Archivo
                    </label>
                    <input
                      id="attachment-file"
                      name="attachment_file"
                      type="file"
                      className="form-input"
                      onChange={(e) => {
                        setUploadError(null);
                        setSelectedFile(e.target.files?.[0] ?? null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="attachment-description">
                      Descripción
                    </label>
                    <input
                      id="attachment-description"
                      name="attachment_description"
                      type="text"
                      className="form-input"
                      value={uploadMeta.description}
                      onChange={(e) => setUploadMeta((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Descripción breve del archivo…"
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  <div>
                    <label className="form-label" htmlFor="attachment-category">
                      Categoría
                    </label>
                    <select
                      id="attachment-category"
                      name="attachment_category"
                      className="form-input"
                      value={uploadMeta.category}
                      onChange={(e) => {
                        const nextCategory = e.target.value;
                        const nextLinkedOrderType =
                          nextCategory === 'EXAMEN'
                            ? 'EXAMEN'
                            : nextCategory === 'DERIVACION'
                              ? 'DERIVACION'
                              : '';
                        setUploadMeta((prev) => ({
                          ...prev,
                          category: nextCategory,
                          linkedOrderType: nextLinkedOrderType,
                          linkedOrderId: '',
                        }));
                      }}
                    >
                      <option value="GENERAL">General</option>
                      <option value="EXAMEN">Resultado de examen</option>
                      <option value="RECETA">Receta</option>
                      <option value="DERIVACION">Derivación</option>
                      <option value="IMAGEN">Imagen clínica</option>
                    </select>
                  </div>
                  {currentLinkedOrderType ? (
                    <div>
                      <label className="form-label" htmlFor="attachment-linked-order">
                        Vincular a{' '}
                        {LINKABLE_ATTACHMENT_LABELS[currentLinkedOrderType as keyof typeof LINKABLE_ATTACHMENT_LABELS]}
                      </label>
                      <select
                        id="attachment-linked-order"
                        name="attachment_linked_order"
                        className="form-input"
                        value={uploadMeta.linkedOrderId}
                        onChange={(e) => setUploadMeta((prev) => ({ ...prev, linkedOrderId: e.target.value }))}
                      >
                        <option value="">Sin vincular a un item específico</option>
                        {currentLinkableOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.nombre}
                            {order.estado ? ` · ${order.estado}` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-ink-muted">
                        {currentLinkableOrders.length > 0
                          ? `Puedes asociar este archivo a un ${LINKABLE_ATTACHMENT_LABELS[currentLinkedOrderType as keyof typeof LINKABLE_ATTACHMENT_LABELS]} estructurado para seguir resultados con más contexto.`
                          : `No hay ${currentLinkedOrderType === 'EXAMEN' ? 'exámenes' : 'derivaciones'} estructurados disponibles todavía.`}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-secondary">
                  {selectedFile
                    ? `Archivo seleccionado: ${selectedFile.name}`
                    : 'Selecciona un archivo para subirlo a esta atención.'}
                </p>
                <button
                  type="submit"
                  className={TOOLBAR_PRIMARY_BUTTON_CLASS}
                  disabled={uploadMutation.isPending || !selectedFile}
                >
                  {uploadMutation.isPending ? 'Subiendo…' : 'Subir Archivo'}
                </button>
              </div>
            </form>
          )}

          {uploadError && <p className="mt-4 text-sm text-status-red-text">{uploadError}</p>}

          <div className="mt-5 overflow-hidden rounded-card border border-surface-muted/35">
            {attachmentsQuery.isLoading ? (
              <div className="p-4 text-sm text-ink-muted">Cargando adjuntos…</div>
            ) : attachmentsQuery.error ? (
              <div className="p-4 text-sm text-status-red-text">
                {String((attachmentsQuery.error as any)?.message ?? 'Error al cargar adjuntos')}
              </div>
            ) : attachments.length === 0 ? (
              <div className="p-4 text-sm text-ink-muted">No hay archivos adjuntos.</div>
            ) : (
              <AttachmentList
                attachments={attachments}
                isDoctor={isDoctor}
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

function AttachmentList({
  attachments,
  isDoctor,
  onDeleteClick,
  onDownload,
}: {
  attachments: Attachment[];
  isDoctor: boolean;
  onDeleteClick: (attachmentId: string) => void;
  onDownload: (a: Attachment) => void;
}) {
  return (
    <ul className="divide-y divide-surface-muted/30">
      {attachments.map((attachment) => (
        <li key={attachment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{attachment.originalName}</p>
            <p className="text-xs text-ink-muted">
              {formatFileSize(attachment.size)} · {formatDateTime(attachment.uploadedAt)}
              {attachment.uploadedBy?.nombre ? ` · ${attachment.uploadedBy.nombre}` : ''}
            </p>
            {(attachment.category || attachment.description) && (
              <p className="text-xs text-ink-muted">
                {[attachment.category, attachment.description].filter(Boolean).join(' · ')}
              </p>
            )}
            {attachment.linkedOrderType && attachment.linkedOrderLabel && (
              <p className="text-xs text-accent-text">
                Vinculado a{' '}
                {LINKABLE_ATTACHMENT_LABELS[attachment.linkedOrderType as keyof typeof LINKABLE_ATTACHMENT_LABELS]}:{' '}
                {attachment.linkedOrderLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onDownload(attachment)} className={TOOLBAR_BUTTON_CLASS}>
              <FiDownload className="h-4 w-4" />
              Descargar
            </button>
            {isDoctor && (
              <button
                type="button"
                onClick={() => onDeleteClick(attachment.id)}
                className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-input bg-status-red px-4 py-3 text-sm font-medium text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-red/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 className="h-4 w-4" />
                Eliminar
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
