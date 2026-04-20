'use client';

import { Attachment } from '@/types';
import { FiPaperclip } from 'react-icons/fi';
import { SectionCallout } from '@/components/sections/SectionPrimitives';
import { LinkedAttachmentList } from '@/components/attachments/LinkedAttachmentList';

interface Props {
  orderId: string;
  type: 'EXAMEN' | 'DERIVACION';
  linkedAttachmentsByOrderId?: Record<string, Attachment[]>;
  readOnly?: boolean;
  onRequestAttachToOrder?: (type: 'EXAMEN' | 'DERIVACION', orderId: string) => void;
  onPreviewAttachment?: (attachment: Attachment) => void;
}

export default function LinkedAttachmentBlock({
  orderId,
  type,
  linkedAttachmentsByOrderId,
  readOnly,
  onRequestAttachToOrder,
  onPreviewAttachment,
}: Props) {
  const linkedAttachments = linkedAttachmentsByOrderId?.[orderId] || [];

  if (linkedAttachments.length === 0 && (readOnly || !onRequestAttachToOrder)) {
    return null;
  }

  return (
    <div className="md:col-span-full">
      <SectionCallout
        tone="subtle"
        actions={!readOnly && onRequestAttachToOrder ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent-text hover:text-ink"
            onClick={() => onRequestAttachToOrder(type, orderId)}
          >
            <FiPaperclip className="h-4 w-4" />
            {type === 'EXAMEN' ? 'Adjuntar resultado' : 'Adjuntar respaldo'}
          </button>
        ) : undefined}
      >
        <div>
          <p className="text-sm font-medium text-ink-primary">
            {linkedAttachments.length > 0
              ? `${linkedAttachments.length} adjunto${linkedAttachments.length === 1 ? '' : 's'} vinculado${linkedAttachments.length === 1 ? '' : 's'}`
              : 'Sin adjuntos vinculados todavía'}
          </p>
          <p className="text-xs text-ink-muted">
            {type === 'EXAMEN'
              ? 'Usa este vínculo para agrupar resultados del examen solicitado.'
              : 'Usa este vínculo para asociar respaldos de la derivación.'}
          </p>
        </div>
      </SectionCallout>
      {linkedAttachments.length > 0 && (
        <LinkedAttachmentList
          attachments={linkedAttachments}
          onPreview={onPreviewAttachment}
          className="mt-3 space-y-2"
        />
      )}
    </div>
  );
}
