'use client';

import type { Dispatch, SetStateAction } from 'react';
import { FiDownload, FiPaperclip, FiTrash2 } from 'react-icons/fi';
import { EmptyState } from '@/components/common/EmptyState';
import type { Attachment } from '@/types';
import {
  LINKABLE_ATTACHMENT_LABELS,
  formatDateTime,
  formatFileSize,
} from './encounter-wizard.constants';

interface UploadMeta {
  description: string;
  category: string;
  linkedOrderType: string;
  linkedOrderId: string;
}

interface LinkableOrder {
  id: string;
  nombre: string;
  estado?: string;
}

interface AttachmentUploadFormProps {
  selectedFile: File | null;
  uploadError: string | null;
  uploadMeta: UploadMeta;
  currentLinkedOrderType: string;
  currentLinkableOrders: LinkableOrder[];
  isPending: boolean;
  setSelectedFile: Dispatch<SetStateAction<File | null>>;
  setUploadError: Dispatch<SetStateAction<string | null>>;
  setUploadMeta: Dispatch<SetStateAction<UploadMeta>>;
  onSubmit: (file: File) => void;
}

export function AttachmentUploadForm({
  selectedFile,
  uploadError,
  uploadMeta,
  currentLinkedOrderType,
  currentLinkableOrders,
  isPending,
  setSelectedFile,
  setUploadError,
  setUploadMeta,
  onSubmit,
}: AttachmentUploadFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!selectedFile) {
          setUploadError('Selecciona un archivo para subir');
          return;
        }
        setUploadError(null);
        onSubmit(selectedFile);
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
              accept=".pdf,.jpg,.jpeg,.png,.gif,application/pdf,image/jpeg,image/png,image/gif"
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
          className="toolbar-btn-primary"
          disabled={isPending || !selectedFile}
        >
          {isPending ? 'Subiendo…' : 'Subir Archivo'}
        </button>
      </div>
    </form>
  );
}

interface AttachmentListProps {
  attachments: Attachment[];
  canDelete: boolean;
  onDeleteClick: (attachmentId: string) => void;
  onDownload: (a: Attachment) => void;
}

export function AttachmentList({
  attachments,
  canDelete,
  onDeleteClick,
  onDownload,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <EmptyState
        icon={<FiPaperclip className="h-6 w-6" aria-hidden="true" />}
        title="Sin archivos adjuntos"
        description="Esta atención no tiene archivos adjuntos."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-surface-muted/35">
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
              <button type="button" onClick={() => onDownload(attachment)} className="toolbar-btn">
                <FiDownload className="h-4 w-4" />
                Descargar
              </button>
              {canDelete && (
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
    </div>
  );
}
