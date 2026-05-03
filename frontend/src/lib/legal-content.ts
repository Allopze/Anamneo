import {
  LEGAL_DOCUMENT_LABELS,
  type LegalDocumentContentJson,
  type LegalDocumentPublic,
  type LegalDocumentType,
} from '../../../shared/legal-contract';

export { LEGAL_DOCUMENT_LABELS };
export type { LegalDocumentContentJson, LegalDocumentPublic, LegalDocumentType };

export type CurrentLegalDocumentsResponse = {
  documents: LegalDocumentPublic[];
};

export const LEGAL_DOCUMENT_ROUTES: Record<LegalDocumentType, string> = {
  TERMS: '/terminos-y-condiciones',
  PRIVACY: '/politica-de-privacidad',
};

export const DEFAULT_LEGAL_REFERENCES = [
  {
    label: 'Ley 19.628',
    href: 'https://www.bcn.cl/leychile/navegar?idLey=19628',
  },
  {
    label: 'Ley 20.584',
    href: 'https://www.bcn.cl/leychile/navegar?idNorma=1039348',
  },
  {
    label: 'Ley 21.719',
    href: 'https://www.bcn.cl/leychile/navegar?idNorma=1209272',
  },
] as const;

export function getLegalDocumentRoute(type: LegalDocumentType) {
  return LEGAL_DOCUMENT_ROUTES[type];
}

export function getLegalDocumentByType(
  response: CurrentLegalDocumentsResponse | undefined,
  type: LegalDocumentType,
) {
  return response?.documents.find((document) => document.type === type) ?? null;
}

export function formatLegalEffectiveDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Sin vigencia definida';
  }

  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(parsed);
}
