export const LEGAL_DOCUMENT_TYPES = ['TERMS', 'PRIVACY'] as const;
export const LEGAL_DOCUMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];
export type LegalDocumentStatus = (typeof LEGAL_DOCUMENT_STATUSES)[number];

export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentType, string> = {
  TERMS: 'Términos y Condiciones de Servicio',
  PRIVACY: 'Política de Privacidad',
};

export function isSupportedLegalDocumentType(value: unknown): value is LegalDocumentType {
  return typeof value === 'string' && LEGAL_DOCUMENT_TYPES.includes(value as LegalDocumentType);
}

export function isSupportedLegalDocumentStatus(value: unknown): value is LegalDocumentStatus {
  return typeof value === 'string' && LEGAL_DOCUMENT_STATUSES.includes(value as LegalDocumentStatus);
}

export type LegalSection = {
  id: string;
  title: string;
  body: string[];
  bullets?: string[];
};

export type LegalDataCategory = {
  label: string;
  examples: string;
  purpose: string;
};

export type LegalReference = {
  label: string;
  href: string;
};

export type LegalDocumentContentJson = {
  summary: string[];
  sections: LegalSection[];
  dataCategories?: LegalDataCategory[];
  contactEmail?: string;
  references?: LegalReference[];
  footerNote?: string;
};

export type LegalDocumentPublic = {
  id: string;
  type: LegalDocumentType;
  status: LegalDocumentStatus;
  title: string;
  description: string;
  version: string;
  effectiveAt: string;
  publishedAt: string | null;
  contentJson: LegalDocumentContentJson;
};
