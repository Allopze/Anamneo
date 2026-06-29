'use client';

import type { Attachment } from '@/types';
import { FiDownload, FiEye } from 'react-icons/fi';

interface LinkedAttachmentListProps {
  attachments: Attachment[];
  onPreview?: (attachment: Attachment) => void;
  onDownload?: (attachment: Attachment) => void;
  className?: string;
  itemClassName?: string;
}

export function LinkedAttachmentList({
  attachments,
  onPreview,
  onDownload,
  className = 'space-y-2',
  itemClassName = 'section-item-card px-3 py-2',
}: LinkedAttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {attachments.map((attachment) => (
        <div key={attachment.id} className={itemClassName}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink-primary">{attachment.originalName}</div>
              <div className="text-xs text-ink-muted">
                {[attachment.description, attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString('es-CL') : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onPreview ? (
                <button
                  type="button"
                  onClick={() => onPreview(attachment)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:text-ink"
                >
                  <FiEye className="h-3.5 w-3.5" />
                  Ver
                </button>
              ) : null}
              {onDownload ? (
                <button
                  type="button"
                  onClick={() => onDownload(attachment)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:text-ink"
                >
                  <FiDownload className="h-3.5 w-3.5" />
                  Descargar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
