import { Transform } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const PATIENT_DATA_CONSENT_PURPOSES = [
  'ATENCION_CLINICA',
  'ANALITICA_INTERNA',
  'COMUNICACIONES',
  'INVESTIGACION',
] as const;

export const PATIENT_DATA_CONSENT_METHODS = [
  'PRESENCIAL_TABLET',
  'WEB_TITULAR',
  'REPRESENTANTE',
] as const;

export const PATIENT_DATA_CONSENT_SIGNER_RELATIONSHIPS = [
  'TITULAR',
  'PADRE',
  'MADRE',
  'TUTOR',
  'REPRESENTANTE',
] as const;

export class GrantPatientDataConsentDto {
  @IsUUID('4', { message: 'patientId debe ser UUID v4 válido' })
  patientId!: string;

  @IsUUID('4', { message: 'legalDocumentId debe ser UUID v4 válido' })
  legalDocumentId!: string;

  @IsIn(PATIENT_DATA_CONSENT_PURPOSES, { message: 'purpose inválido' })
  purpose!: typeof PATIENT_DATA_CONSENT_PURPOSES[number];

  @IsIn(PATIENT_DATA_CONSENT_METHODS, { message: 'method inválido' })
  method!: typeof PATIENT_DATA_CONSENT_METHODS[number];

  @IsString()
  @MinLength(2, { message: 'signerName debe tener al menos 2 caracteres' })
  @MaxLength(200)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  signerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  signerRut?: string;

  @IsIn(PATIENT_DATA_CONSENT_SIGNER_RELATIONSHIPS, { message: 'signerRelationship inválido' })
  signerRelationship!: typeof PATIENT_DATA_CONSENT_SIGNER_RELATIONSHIPS[number];

  // ---- Campos opcionales recomendados por asesor legal (§2.4) ----

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsUUID('4')
  clinicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  representativeBondEvidenceRef?: string;

  // Snapshot del payload mostrado al titular (texto, checkboxes, version UI)
  // El hash de este objeto se comparara con `evidenceHash` para asegurar integridad.
  @IsOptional()
  @IsObject()
  consentPayloadSnapshot?: Record<string, unknown>;
}

export const PATIENT_DATA_CONSENT_REVOKED_CHANNELS = [
  'WEB_TITULAR',
  'PRESENCIAL',
  'EMAIL',
  'DPO',
] as const;

export class RevokePatientDataConsentDto {
  @IsString()
  @MinLength(2, { message: 'El motivo debe tener al menos 2 caracteres' })
  @MaxLength(1000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  reason!: string;

  @IsOptional()
  @IsIn(PATIENT_DATA_CONSENT_REVOKED_CHANNELS)
  channel?: typeof PATIENT_DATA_CONSENT_REVOKED_CHANNELS[number];
}
