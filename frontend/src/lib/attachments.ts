import type { Attachment } from '@/types';

export function groupAttachmentsByOrderId(
  attachments: Attachment[] | null | undefined,
): Record<string, Attachment[]> {
  return (attachments ?? []).reduce<Record<string, Attachment[]>>((accumulator, attachment) => {
    if (!attachment.linkedOrderId) {
      return accumulator;
    }

    if (!accumulator[attachment.linkedOrderId]) {
      accumulator[attachment.linkedOrderId] = [];
    }

    accumulator[attachment.linkedOrderId].push(attachment);
    return accumulator;
  }, {});
}
