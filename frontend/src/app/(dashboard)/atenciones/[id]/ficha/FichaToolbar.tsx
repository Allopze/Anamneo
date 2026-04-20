import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiCopy, FiDownload, FiEdit3, FiPrinter, FiShield } from 'react-icons/fi';
import clsx from 'clsx';
import type { Encounter } from '@/types';
import { DUPLICATE_ENCOUNTER_ACTION_TITLE, getDuplicateEncounterActionLabel } from '@/lib/encounter-duplicate';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';

interface FichaToolbarProps {
  id: string;
  encounter: Encounter | undefined;
  canSign: boolean;
  canReopen: boolean;
  canDuplicate: boolean;
  focusedDocumentBlockedReason: string | null;
  pdfBlockedReason: string | null;
  printBlockedReason: string | null;
  signIsPending: boolean;
  reopenIsPending: boolean;
  duplicateIsPending: boolean;
  onDownloadDocument: (kind: 'pdf' | 'receta' | 'ordenes' | 'derivacion') => void;
  onDownloadPdf: () => void;
  onPrint: () => void;
  onSign: () => void;
  onReopen: () => void;
  onDuplicate: () => void;
}

export function FichaToolbar({
  id,
  encounter,
  canSign,
  canReopen,
  canDuplicate,
  focusedDocumentBlockedReason,
  pdfBlockedReason,
  printBlockedReason,
  signIsPending,
  reopenIsPending,
  duplicateIsPending,
  onDownloadDocument,
  onDownloadPdf,
  onPrint,
  onSign,
  onReopen,
  onDuplicate,
}: FichaToolbarProps) {
  const headerBarSlot = useHeaderBarSlot();

  const toolbarActions = useMemo(() => {
    if (!encounter) {
      return null;
    }

    return (
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto py-0.5">
        <Link
          href={`/atenciones/${id}`}
          className="btn btn-secondary flex shrink-0 items-center gap-2"
        >
          <FiArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{encounter.status === 'COMPLETADO' ? 'Resumen' : 'Edición'}</span>
        </Link>

        <div className="hidden h-6 w-px shrink-0 bg-surface-muted/50 lg:block" aria-hidden="true" />

        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          {canDuplicate ? (
            <button
              onClick={onDuplicate}
              disabled={duplicateIsPending}
              className="btn btn-secondary flex shrink-0 items-center gap-2"
              title={DUPLICATE_ENCOUNTER_ACTION_TITLE}
            >
              <FiCopy className="h-4 w-4" />
              {getDuplicateEncounterActionLabel(duplicateIsPending)}
            </button>
          ) : null}
          <button
            onClick={() => onDownloadDocument('receta')}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', focusedDocumentBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(focusedDocumentBlockedReason)}
            title={focusedDocumentBlockedReason ?? 'Descargar receta'}
          >
            <FiDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Receta</span>
          </button>
          <button
            onClick={() => onDownloadDocument('ordenes')}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', focusedDocumentBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(focusedDocumentBlockedReason)}
            title={focusedDocumentBlockedReason ?? 'Descargar órdenes'}
          >
            <FiDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Órdenes</span>
          </button>
          <button
            onClick={() => onDownloadDocument('derivacion')}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', focusedDocumentBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(focusedDocumentBlockedReason)}
            title={focusedDocumentBlockedReason ?? 'Descargar derivación'}
          >
            <FiDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Derivación</span>
          </button>
          <button
            onClick={onDownloadPdf}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', pdfBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(pdfBlockedReason)}
            title={pdfBlockedReason ?? 'Descargar PDF completo'}
            aria-label="Descargar PDF"
          >
            <FiDownload className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={onPrint}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', printBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(printBlockedReason)}
            title={printBlockedReason ?? 'Imprimir ficha'}
          >
            <FiPrinter className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          {canSign ? (
            <button
              onClick={onSign}
              disabled={signIsPending}
              className="btn flex shrink-0 items-center gap-2 border-status-red/40 bg-status-red/15 font-semibold text-status-red-text hover:bg-status-red/25"
            >
              <FiShield className="h-4 w-4" />
              Firmar
            </button>
          ) : null}
          {canReopen ? (
            <button
              onClick={onReopen}
              disabled={reopenIsPending}
              className="btn btn-secondary flex shrink-0 items-center gap-2"
            >
              <FiEdit3 className="h-4 w-4" />
              {reopenIsPending ? 'Reabriendo…' : 'Reabrir'}
            </button>
          ) : null}
          {encounter.status === 'FIRMADO' ? (
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-status-green/50 bg-status-green/20 px-3 py-1.5 text-xs font-semibold text-status-green-text">
              <FiShield className="h-3.5 w-3.5" />
              Firmada
            </span>
          ) : null}
        </div>
      </div>
    );
  }, [
    encounter,
    focusedDocumentBlockedReason,
    pdfBlockedReason,
    onDownloadDocument,
    onDuplicate,
    onDownloadPdf,
    onPrint,
    onSign,
    id,
    canDuplicate,
    canSign,
    canReopen,
    duplicateIsPending,
    printBlockedReason,
    reopenIsPending,
    signIsPending,
    onReopen,
  ]);

  useEffect(() => {
    if (!headerBarSlot || !toolbarActions) {
      return;
    }

    headerBarSlot.setHeaderBarSlot(toolbarActions);
    return () => {
      headerBarSlot.setHeaderBarSlot(null);
    };
  }, [headerBarSlot, toolbarActions]);

  // Fallback when no header bar slot available
  if (!headerBarSlot && toolbarActions) {
    return (
      <div className="no-print sticky top-0 z-30 border-b border-surface-muted/30 bg-surface-elevated px-4 py-3">
        <div className="mx-auto max-w-4xl">
          {toolbarActions}
        </div>
      </div>
    );
  }

  return null;
}
