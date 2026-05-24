import { createHmac } from 'crypto';
import { decryptField, encryptField } from '../common/utils/field-crypto';

export type PatientIdentifierInput = {
  rut?: string | null;
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  domicilio?: string | null;
  contactoEmergenciaNombre?: string | null;
  contactoEmergenciaTelefono?: string | null;
  legalRepresentativeName?: string | null;
  legalRepresentativeRut?: string | null;
  legalRepresentativeRelationship?: string | null;
  legalRepresentativeContact?: string | null;
};

export type PatientEncryptedIdentifierShape = {
  rutEnc?: string | null;
  nombreEnc?: string | null;
  telefonoEnc?: string | null;
  emailEnc?: string | null;
  domicilioEnc?: string | null;
  contactoEmergenciaNombreEnc?: string | null;
  contactoEmergenciaTelefonoEnc?: string | null;
  legalRepresentativeNameEnc?: string | null;
  legalRepresentativeRutEnc?: string | null;
  legalRepresentativeRutLookupHash?: string | null;
  legalRepresentativeRelationshipEnc?: string | null;
  legalRepresentativeContactEnc?: string | null;
  // Plaintext columns — kept temporarily until Phase D-drop backfill is applied
  legalRepresentativeName?: string | null;
  legalRepresentativeRut?: string | null;
  legalRepresentativeRelationship?: string | null;
  legalRepresentativeContact?: string | null;
};

export type PatientPlainIdentifiers = {
  rut: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  domicilio: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  legalRepresentativeName: string | null;
  legalRepresentativeRut: string | null;
  legalRepresentativeRelationship: string | null;
  legalRepresentativeContact: string | null;
};

export const PATIENT_ENCRYPTED_IDENTIFIER_SELECT = {
  rutEnc: true,
  nombreEnc: true,
  telefonoEnc: true,
  emailEnc: true,
  domicilioEnc: true,
  contactoEmergenciaNombreEnc: true,
  contactoEmergenciaTelefonoEnc: true,
  legalRepresentativeNameEnc: true,
  legalRepresentativeRutEnc: true,
  legalRepresentativeRutLookupHash: true,
  legalRepresentativeRelationshipEnc: true,
  legalRepresentativeContactEnc: true,
} as const;

export function normalizeRutLookupValue(rut: string | null | undefined): string | null {
  if (!rut) return null;
  const normalized = rut
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return normalized || null;
}

function requireEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY?.trim();
  if (!key || key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (256 bits). '
      + 'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return key;
}

export function computeRutLookupHash(rut: string | null | undefined): string | null {
  const normalized = normalizeRutLookupValue(rut);
  if (!normalized) return null;

  const PEPPER = 'anamneo.v1.patient.rut_lookup';
  return createHmac('sha256', Buffer.from(requireEncryptionKey(), 'hex'))
    .update(`${PEPPER}:${normalized}`)
    .digest('hex');
}

function encryptIdentifierValue(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return encryptField(value);
}

export function buildEncryptedPatientIdentifierFields(input: PatientIdentifierInput) {
  return {
    rutEnc: encryptIdentifierValue(input.rut),
    rutLookupHash: computeRutLookupHash(input.rut),
    nombreEnc: encryptIdentifierValue(input.nombre),
    telefonoEnc: encryptIdentifierValue(input.telefono),
    emailEnc: encryptIdentifierValue(input.email),
    domicilioEnc: encryptIdentifierValue(input.domicilio),
    contactoEmergenciaNombreEnc: encryptIdentifierValue(input.contactoEmergenciaNombre),
    contactoEmergenciaTelefonoEnc: encryptIdentifierValue(input.contactoEmergenciaTelefono),
    legalRepresentativeNameEnc: encryptIdentifierValue(input.legalRepresentativeName),
    legalRepresentativeRutEnc: encryptIdentifierValue(input.legalRepresentativeRut),
    legalRepresentativeRutLookupHash: computeRutLookupHash(input.legalRepresentativeRut),
    legalRepresentativeRelationshipEnc: encryptIdentifierValue(input.legalRepresentativeRelationship),
    legalRepresentativeContactEnc: encryptIdentifierValue(input.legalRepresentativeContact),
  };
}

export function decryptPatientIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  return decryptField(value);
}

export function resolvePatientIdentifiers(patient: PatientEncryptedIdentifierShape): PatientPlainIdentifiers {
  return {
    rut: decryptPatientIdentifier(patient.rutEnc),
    nombre: decryptPatientIdentifier(patient.nombreEnc) ?? '',
    telefono: decryptPatientIdentifier(patient.telefonoEnc),
    email: decryptPatientIdentifier(patient.emailEnc),
    domicilio: decryptPatientIdentifier(patient.domicilioEnc),
    contactoEmergenciaNombre: decryptPatientIdentifier(patient.contactoEmergenciaNombreEnc),
    contactoEmergenciaTelefono: decryptPatientIdentifier(patient.contactoEmergenciaTelefonoEnc),
    // Phase D — descifrar representante legal. Fallback a plaintext durante la ventana de backfill.
    legalRepresentativeName: decryptPatientIdentifier(patient.legalRepresentativeNameEnc) ?? patient.legalRepresentativeName ?? null,
    legalRepresentativeRut: decryptPatientIdentifier(patient.legalRepresentativeRutEnc) ?? patient.legalRepresentativeRut ?? null,
    legalRepresentativeRelationship: decryptPatientIdentifier(patient.legalRepresentativeRelationshipEnc) ?? patient.legalRepresentativeRelationship ?? null,
    legalRepresentativeContact: decryptPatientIdentifier(patient.legalRepresentativeContactEnc) ?? patient.legalRepresentativeContact ?? null,
  };
}

export function withPatientIdentifiers<T extends PatientEncryptedIdentifierShape>(patient: T) {
  return {
    ...patient,
    ...resolvePatientIdentifiers(patient),
  };
}

export function normalizeIdentifierSearchText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function patientMatchesIdentifierSearch(patient: PatientEncryptedIdentifierShape, search: string): boolean {
  const normalizedSearch = normalizeIdentifierSearchText(search);
  if (!normalizedSearch) return true;

  const identifiers = resolvePatientIdentifiers(patient);
  const searchableValues = [
    identifiers.nombre,
    identifiers.rut,
    identifiers.telefono,
    identifiers.email,
    identifiers.domicilio,
    identifiers.contactoEmergenciaNombre,
    identifiers.contactoEmergenciaTelefono,
  ];

  return searchableValues.some((value) => normalizeIdentifierSearchText(value).includes(normalizedSearch));
}
