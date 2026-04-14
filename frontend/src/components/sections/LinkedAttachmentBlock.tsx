'use client';

import { Attachment } from '@/types';
import { FiEye, FiPaperclip } from 'react-icons/fi';
import { SectionCallout } from '@/components/sections/SectionPrimitives';

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
        <div className="mt-3 space-y-2">
          {linkedAttachments.map((attachment) => (
            <div key={attachment.id} className="section-item-card px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-primary">{attachment.originalName}</div>
                  <div className="text-xs text-ink-muted">
                    {[attachment.description, attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString('es-CL') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {onPreviewAttachment && (
                  <button
                    type="button"
                    onClick={() => onPreviewAttachment(attachment)}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent-text hover:text-ink"
                  >
                    <FiEye className="h-3.5 w-3.5" />
                    Ver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
