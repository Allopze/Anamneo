'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="flex w-full max-w-4xl flex-col overflow-hidden rounded-card border border-surface-muted/30 bg-surface-elevated shadow-dropdown"
          style={{ maxHeight: '90vh' }}
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa: ${title}`}
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
                <FiDownload className="h-3.5 w-3.5" />
                Descargar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-input p-2 text-ink-muted transition-colors hover:bg-surface-base/65 hover:text-ink-secondary"
                aria-label="Cerrar"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-base/40 p-4">
            {loading && (
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-sm text-ink-muted">Generando vista previa…</span>
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
        </div>
      </div>
    </>
  );
}
