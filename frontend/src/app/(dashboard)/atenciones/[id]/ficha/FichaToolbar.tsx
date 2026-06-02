import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiCopy,
  FiDownload,
  FiEdit3,
  FiEye,
  FiMoreHorizontal,
  FiPrinter,
  FiShield,
} from 'react-icons/fi';
import type { Encounter } from '@/types';
import { DUPLICATE_ENCOUNTER_ACTION_TITLE, getDuplicateEncounterActionLabel } from '@/lib/encounter-duplicate';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';
import { FichaToolbarMenu, type ToolbarMenuItem } from './FichaToolbarMenu';

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
  onPreviewDocument: (kind: 'pdf' | 'receta' | 'ordenes' | 'derivacion') => void;
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
  onPreviewDocument,
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

    const outputActions: ToolbarMenuItem[] = [
      {
        key: 'preview-receta',
        label: 'Vista previa receta',
        icon: FiEye,
        onSelect: () => onPreviewDocument('receta'),
        disabled: Boolean(focusedDocumentBlockedReason),
        title: focusedDocumentBlockedReason ?? 'Vista previa de receta',
      },
      {
        key: 'receta',
        label: 'Descargar receta',
        icon: FiDownload,
        onSelect: () => onDownloadDocument('receta'),
        disabled: Boolean(focusedDocumentBlockedReason),
        title: focusedDocumentBlockedReason ?? 'Descargar receta',
      },
      {
        key: 'preview-ordenes',
        label: 'Vista previa órdenes',
        icon: FiEye,
        onSelect: () => onPreviewDocument('ordenes'),
        disabled: Boolean(focusedDocumentBlockedReason),
        title: focusedDocumentBlockedReason ?? 'Vista previa de órdenes',
      },
      {
        key: 'ordenes',
        label: 'Descargar órdenes',
        icon: FiDownload,
        onSelect: () => onDownloadDocument('ordenes'),
        disabled: Boolean(focusedDocumentBlockedReason),
        title: focusedDocumentBlockedReason ?? 'Descargar órdenes',
      },
      {
        key: 'preview-derivacion',
        label: 'Vista previa derivación',
        icon: FiEye,
        onSelect: () => onPreviewDocument('derivacion'),
        disabled: Boolean(focusedDocumentBlockedReason),
        title: focusedDocumentBlockedReason ?? 'Vista previa de derivación',
      },
      {
        key: 'derivacion',
        label: 'Descargar derivación',
        icon: FiDownload,
        onSelect: () => onDownloadDocument('derivacion'),
        disabled: Boolean(focusedDocumentBlockedReason),
        title: focusedDocumentBlockedReason ?? 'Descargar derivación',
      },
      {
        key: 'preview-pdf',
        label: 'Vista previa PDF completo',
        icon: FiEye,
        onSelect: () => onPreviewDocument('pdf'),
        disabled: Boolean(pdfBlockedReason),
        title: pdfBlockedReason ?? 'Vista previa del PDF completo',
      },
      {
        key: 'pdf',
        label: 'Descargar PDF',
        icon: FiDownload,
        onSelect: onDownloadPdf,
        disabled: Boolean(pdfBlockedReason),
        title: pdfBlockedReason ?? 'Descargar PDF completo',
      },
      {
        key: 'print',
        label: 'Imprimir',
        icon: FiPrinter,
        onSelect: onPrint,
        disabled: Boolean(printBlockedReason),
        title: printBlockedReason ?? 'Imprimir ficha',
      },
    ];

    const secondaryActions: ToolbarMenuItem[] = [
      ...(canDuplicate
        ? [{
            key: 'duplicate',
            label: getDuplicateEncounterActionLabel(duplicateIsPending),
            icon: FiCopy,
            onSelect: onDuplicate,
            disabled: duplicateIsPending,
            title: DUPLICATE_ENCOUNTER_ACTION_TITLE,
          }]
        : []),
    ];

    return (
      <div className="flex max-w-full min-w-0 flex-nowrap items-center justify-start gap-2 overflow-x-auto py-0.5 pr-1 md:flex-wrap md:justify-end md:overflow-visible">
        <Link
          href={`/atenciones/${id}`}
          className="btn btn-secondary flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4"
          aria-label={encounter.status === 'COMPLETADO' ? 'Volver al resumen' : 'Volver a edición'}
        >
          <FiArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{encounter.status === 'COMPLETADO' ? 'Resumen' : 'Edición'}</span>
        </Link>

        {encounter.status === 'FIRMADO' ? (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-status-green/50 bg-status-green/20 px-3 py-2 text-xs font-semibold text-status-green-text">
            <FiShield className="h-3.5 w-3.5" />
            Firmada
          </span>
        ) : null}

        <FichaToolbarMenu
          label="Exportar"
          ariaLabel="Exportar documentos"
          icon={FiDownload}
          items={outputActions}
          compactLabel
        />

        {canSign ? (
          <button
            onClick={onSign}
            disabled={signIsPending}
            aria-label="Firmar"
            className="btn flex shrink-0 items-center gap-2 border-status-red/40 bg-status-red/15 px-3 py-2 font-semibold text-status-red-text hover:bg-status-red/25 sm:px-4"
          >
            <FiShield className="h-4 w-4" />
            <span className="hidden sm:inline">{signIsPending ? 'Firmando…' : 'Firmar'}</span>
          </button>
        ) : null}

        {canReopen ? (
          <button
            onClick={onReopen}
            disabled={reopenIsPending}
            aria-label="Reabrir"
            className="btn btn-secondary flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4"
          >
            <FiEdit3 className="h-4 w-4" />
            <span className="hidden sm:inline">{reopenIsPending ? 'Reabriendo…' : 'Reabrir'}</span>
          </button>
        ) : null}

        <FichaToolbarMenu
          label="Más"
          ariaLabel="Más acciones"
          icon={FiMoreHorizontal}
          items={secondaryActions}
          compactLabel
        />
      </div>
    );
  }, [
    encounter,
    focusedDocumentBlockedReason,
    pdfBlockedReason,
    onDownloadDocument,
    onDownloadPdf,
    onPreviewDocument,
    onDuplicate,
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
