import { FiPaperclip } from 'react-icons/fi';
import type { Attachment } from '@/types';
import { LinkedAttachmentList } from '@/components/attachments/LinkedAttachmentList';

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
      <LinkedAttachmentList
        attachments={attachments}
        onPreview={onPreview}
        onDownload={onDownload}
        className="mt-2 space-y-2"
        itemClassName="rounded-md bg-surface-elevated px-3 py-2"
      />
    </div>
  );
}
