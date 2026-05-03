export const LEGAL_DOCUMENT_VERSION = '2026-05-02';

export const LEGAL_DOCUMENT_TYPES = ['TERMS', 'PRIVACY'] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  TERMS: 'Términos y Condiciones de Servicio',
  PRIVACY: 'Política de Privacidad',
};

export function isSupportedLegalDocumentType(value: unknown): value is LegalDocumentType {
  return typeof value === 'string' && LEGAL_DOCUMENT_TYPES.includes(value as LegalDocumentType);
}
