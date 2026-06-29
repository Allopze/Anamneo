import {
  METHODS,
  PURPOSES,
  REVOKE_CHANNELS,
  SIGNER_RELATIONSHIPS,
} from './constants';

export interface LegalDocument {
  id: string;
  type: string;
  version: string;
  title: string;
}

export interface DataProcessingConsent {
  id: string;
  patientId: string;
  legalDocumentId: string;
  purpose: string;
  granted: boolean;
  grantedAt: string;
  revokedAt: string | null;
  method: string;
  signerName: string;
  signerRut: string | null;
  signerRelationship: string;
  evidenceHash: string;
  legalDocument?: LegalDocument | null;
  capturedBy?: { id: string; nombre: string } | null;
}

export type ConsentPurpose = typeof PURPOSES[number]['value'];
export type ConsentMethod = typeof METHODS[number]['value'];
export type SignerRelationship = typeof SIGNER_RELATIONSHIPS[number]['value'];
export type RevokeChannel = typeof REVOKE_CHANNELS[number]['value'];

export interface GrantConsentFormState {
  legalDocumentId: string;
  purpose: ConsentPurpose;
  method: ConsentMethod;
  signerName: string;
  signerRut: string;
  signerRelationship: SignerRelationship;
}
