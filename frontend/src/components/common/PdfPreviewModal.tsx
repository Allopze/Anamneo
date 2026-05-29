'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { Dialog } from './Dialog';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint: string;
  fallbackFilename: string;
  title: string;
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  endpoint,
  fallbackFilename,
  title,
}: PdfPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedFilename, setResolvedFilename] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const blobUrlRef = useRef<string | null>(null);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      window.URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      revokeBlobUrl();
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    revokeBlobUrl();

    api
      .get(endpoint, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        const disposition = response.headers['content-disposition'] as string | undefined;
        let name: string | null = null;
        if (disposition) {
          const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
          name = utf8Match?.[1]
            ? decodeURIComponent(utf8Match[1])
            : (/filename="?([^"]+)"?/i.exec(disposition)?.[1] ?? null);
        }
        setResolvedFilename(name);
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // retryCount in deps so handleRetry re-triggers the fetch
  }, [isOpen, endpoint, retryCount, revokeBlobUrl]);

  useEffect(() => revokeBlobUrl, [revokeBlobUrl]);

  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = resolvedFilename ?? fallbackFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [blobUrl, resolvedFilename, fallbackFilename]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      role="dialog"
      title={`Vista previa: ${title}`}
      maxWidth="4xl"
      className="flex flex-col overflow-hidden"
      panelStyle={{ maxHeight: '90vh' }}
    >
      <div className="flex items-center justify-between border-b border-surface-muted/30 px-5 py-3">
        <p className="truncate text-sm font-semibold text-ink-primary">{title}</p>
        <div className="flex items-center gap-2 pl-4">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!blobUrl}
            className="inline-flex items-center gap-1.5 rounded-input px-3 py-1.5 text-xs font-medium text-accent-text transition-colors hover:bg-surface-base/65 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-base/40 p-4">
        {loading && (
          <div className="w-full max-w-lg space-y-3" aria-busy="true" aria-label="Generando vista previa">
            <div className="h-6 skeleton rounded-card" />
            <div className="h-4 skeleton rounded-card w-3/4" />
            <div className="mt-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`h-3 skeleton rounded-card ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-3 skeleton rounded-card ${i === 4 ? 'w-1/2' : 'w-full'}`} />
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-ink-secondary">{error}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRetryCount((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && blobUrl && (
          <iframe
            src={blobUrl}
            title={title}
            className="h-full w-full rounded"
            style={{ minHeight: '70vh' }}
          />
        )}
      </div>
    </Dialog>
  );
}
