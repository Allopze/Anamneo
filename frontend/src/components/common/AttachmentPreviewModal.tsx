'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { api } from '@/lib/api';
import type { Attachment } from '@/types';
import { notify } from '@/lib/notify';
import { Dialog } from './Dialog';

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: Attachment | null;
}

export default function AttachmentPreviewModal({
  isOpen,
  onClose,
  attachment,
}: AttachmentPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      window.URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  useEffect(() => {
    if (!isOpen || !attachment) {
      revokeBlobUrl();
      return;
    }

    let cancelled = false;
    setLoading(true);
    revokeBlobUrl();

    api
      .get(`/attachments/${attachment.id}/download`, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        const blob = new Blob([response.data], { type: attachment.mime });
        const url = window.URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) notify.error('Error al cargar el adjunto');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, attachment, revokeBlobUrl]);

  // Cleanup on unmount
  useEffect(() => revokeBlobUrl, [revokeBlobUrl]);

  const handleDownload = useCallback(() => {
    if (!blobUrl || !attachment) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = attachment.originalName || 'archivo';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [blobUrl, attachment]);

  const isImage = attachment?.mime.startsWith('image/') ?? false;
  const isPdf = attachment?.mime === 'application/pdf';
  const canPreview = isImage || isPdf;

  return (
    <Dialog
      isOpen={isOpen && attachment !== null}
      onClose={onClose}
      role="dialog"
      title={attachment ? `Vista previa: ${attachment.originalName}` : 'Vista previa'}
      maxWidth="4xl"
      className="flex flex-col overflow-hidden"
      panelStyle={{ maxHeight: '90vh' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-muted/30 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-primary">
            {attachment?.originalName}
          </p>
          {attachment?.description && (
            <p className="truncate text-xs text-ink-muted">{attachment.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 pl-4">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!blobUrl}
            className="inline-flex items-center gap-1.5 rounded-input px-3 py-1.5 text-xs font-medium text-accent-text transition-colors hover:bg-surface-base/65"
          >
            <FiDownload className="h-3.5 w-3.5" aria-hidden="true" />
            Descargar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
            aria-label="Cerrar"
          >
            <FiX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-base/40 p-4">
        {loading && (
          <div className="w-full max-w-lg space-y-3" aria-busy="true" aria-label="Cargando vista previa">
            <div className="h-64 skeleton rounded-card" />
            <div className="h-4 skeleton rounded w-3/4" />
            <div className="h-3 skeleton rounded w-1/2" />
          </div>
        )}

        {!loading && !blobUrl && (
          <div className="text-sm text-ink-muted">No se pudo cargar el archivo.</div>
        )}

        {!loading && blobUrl && attachment && isImage && (
          <div className="relative h-[70vh] w-full overflow-hidden">
            <Image
              src={blobUrl}
              alt={attachment.originalName}
              fill
              unoptimized
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 1024px"
            />
          </div>
        )}

        {!loading && blobUrl && attachment && isPdf && (
          <iframe
            src={blobUrl}
            title={attachment.originalName}
            className="h-full w-full"
            style={{ minHeight: '60vh' }}
          />
        )}

        {!loading && blobUrl && !canPreview && (
          <div className="text-center">
            <p className="mb-3 text-sm text-ink-secondary">
              Vista previa no disponible para este tipo de archivo.
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <FiDownload className="h-4 w-4" aria-hidden="true" />
              Descargar archivo
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
