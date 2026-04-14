import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiDownload, FiPrinter, FiShield } from 'react-icons/fi';
import clsx from 'clsx';
import type { Encounter } from '@/types';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';

interface FichaToolbarProps {
  id: string;
  encounter: Encounter | undefined;
  isDoctor: boolean;
  exportBlockedReason: string | null;
  printBlockedReason: string | null;
  signIsPending: boolean;
  onDownloadDocument: (kind: 'pdf' | 'receta' | 'ordenes' | 'derivacion') => void;
  onDownloadPdf: () => void;
  onPrint: () => void;
  onSign: () => void;
}

export function FichaToolbar({
  id,
  encounter,
  isDoctor,
  exportBlockedReason,
  printBlockedReason,
  signIsPending,
  onDownloadDocument,
  onDownloadPdf,
  onPrint,
  onSign,
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
          <button
            onClick={() => onDownloadDocument('receta')}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', exportBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(exportBlockedReason)}
            title={exportBlockedReason ?? 'Descargar receta'}
          >
            <FiDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Receta</span>
          </button>
          <button
            onClick={() => onDownloadDocument('ordenes')}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', exportBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(exportBlockedReason)}
            title={exportBlockedReason ?? 'Descargar órdenes'}
          >
            <FiDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Órdenes</span>
          </button>
          <button
            onClick={() => onDownloadDocument('derivacion')}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', exportBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(exportBlockedReason)}
            title={exportBlockedReason ?? 'Descargar derivación'}
          >
            <FiDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Derivación</span>
          </button>
          <button
            onClick={onDownloadPdf}
            className={clsx('btn btn-secondary flex shrink-0 items-center gap-2', exportBlockedReason && 'cursor-not-allowed opacity-60')}
            disabled={Boolean(exportBlockedReason)}
            title={exportBlockedReason ?? 'Descargar PDF completo'}
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
          {encounter.status === 'COMPLETADO' && isDoctor ? (
            <button
              onClick={onSign}
              disabled={signIsPending}
              className="btn flex shrink-0 items-center gap-2 border-status-red/40 bg-status-red/15 font-semibold text-status-red-text hover:bg-status-red/25"
            >
              <FiShield className="h-4 w-4" />
              Firmar
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
    exportBlockedReason,
    onDownloadDocument,
    onDownloadPdf,
    onPrint,
    onSign,
    id,
    isDoctor,
    printBlockedReason,
    signIsPending,
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
