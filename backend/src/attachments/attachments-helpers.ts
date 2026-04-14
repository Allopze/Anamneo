import * as path from 'path';

export const SIGNATURE_BYTES_TO_READ = 16;

export const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
]);

export const LINKABLE_ORDER_FIELDS = {
  EXAMEN: 'examenesEstructurados',
  DERIVACION: 'derivacionesEstructuradas',
} as const;

export type LinkedOrderType = keyof typeof LINKABLE_ORDER_FIELDS;

export type AttachmentMetadata = {
  category?: string;
  description?: string;
  linkedOrderType?: string;
  linkedOrderId?: string;
};

export type StructuredOrder = {
  id?: string;
  nombre?: string;
};

export function sanitizeFilename(name: string): string {
  const baseName = path.basename(name || '').replace(/[\r\n"]/g, '_').trim();
  return baseName || 'adjunto';
}

export function normalizeMimeType(mime: string): string {
  if (mime === 'image/jpg' || mime === 'image/pjpeg') {
    return 'image/jpeg';
  }

  return (mime || '').toLowerCase();
}

export function detectMimeFromSignature(header: Buffer): string | null {
  if (header.length >= 5 && header.subarray(0, 5).toString('utf8') === '%PDF-') {
    return 'application/pdf';
  }

  if (
    header.length >= 3
    && header[0] === 0xff
    && header[1] === 0xd8
    && header[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    header.length >= 8
    && header[0] === 0x89
    && header[1] === 0x50
    && header[2] === 0x4e
    && header[3] === 0x47
    && header[4] === 0x0d
    && header[5] === 0x0a
    && header[6] === 0x1a
    && header[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (header.length >= 6) {
    const gifHeader = header.subarray(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return 'image/gif';
    }
  }

  return null;
}
