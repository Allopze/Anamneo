import { FiPaperclip, FiEye, FiDownload } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Attachment } from '@/types';

interface LinkedAttachmentsProps {
  orderId?: string;
  attachmentsByOrderId: Record<string, Attachment[]>;
  onPreview: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
}

export function LinkedAttachments({ orderId, attachmentsByOrderId, onPreview, onDownload }: LinkedAttachmentsProps) {
  if (!orderId) return null;

  const attachments = attachmentsByOrderId[orderId] || [];
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 rounded-card border border-surface-muted/30 bg-surface-base/40 p-3">
      <div className="flex items-center gap-2 text-ink-secondary">
        <FiPaperclip className="h-4 w-4" />
        <span className="text-sm font-medium">Adjuntos vinculados</span>
      </div>
      <ul className="mt-2 space-y-2">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="rounded-md bg-surface-elevated px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-primary">{attachment.originalName}</p>
                <p className="text-xs text-ink-muted">
                  {[attachment.description, attachment.uploadedAt ? format(new Date(attachment.uploadedAt), "d MMM yyyy", { locale: es }) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPreview(attachment)}
                className="no-print inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:text-ink"
              >
                <FiEye className="h-3.5 w-3.5" />
                Ver
              </button>
              <button
                type="button"
                onClick={() => onDownload(attachment)}
                className="no-print inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:text-ink"
              >
                <FiDownload className="h-3.5 w-3.5" />
                Descargar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
