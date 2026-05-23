import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const PATIENT_DATA_REQUEST_TYPES = [
  'ACCESO',
  'RECTIFICACION',
  'SUPRESION',
  'OPOSICION',
  'PORTABILIDAD',
  'BLOQUEO',
] as const;

export const PATIENT_DATA_REQUEST_STATUSES = [
  'RECIBIDA',
  'EN_REVISION',
  'RESUELTA_ACEPTADA',
  'RESUELTA_RECHAZADA',
  'VENCIDA',
] as const;

export const PATIENT_DATA_REQUEST_SUBMITTED_BY = [
  'TITULAR',
  'REPRESENTANTE',
  'ADMIN',
] as const;

export const IDENTITY_VERIFICATION_METHODS = [
  'PRESENCIAL',
  'CEDULA_FOTO',
  'CLAVE_UNICA',
  'OTRO',
] as const;

/**
 * Cuerpo de la solicitud publica del titular. El endpoint publico SOLO
 * acepta este DTO y crea una solicitud en estado RECIBIDA con el rol
 * `TITULAR` por defecto. Un admin puede luego completarla con identidad
 * verificada y resolverla.
 */
export class PublicDataRequestDto {
  @IsString()
  @MinLength(2, { message: 'requesterName debe tener al menos 2 caracteres' })
  @MaxLength(200)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  requesterName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  requesterRut?: string;

  @IsEmail({}, { message: 'requesterEmail debe ser un email válido' })
  @MaxLength(254)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  requesterEmail!: string;

  @IsIn(PATIENT_DATA_REQUEST_TYPES)
  requestType!: typeof PATIENT_DATA_REQUEST_TYPES[number];

  @IsString()
  @MinLength(10, { message: 'descripción de la solicitud debe tener al menos 10 caracteres' })
  @MaxLength(2000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  payloadRequest!: string;

  // Opcional: si el titular es padre/madre/tutor de un NNA
  @IsOptional()
  @IsIn(['REPRESENTANTE'])
  submittedBy?: 'REPRESENTANTE';
}

/**
 * DTO para que un admin/DPO vincule la solicitud a un Patient, registre
 * verificación de identidad, marque En Revision, o resuelva.
 */
export class AdminUpdateDataRequestDto {
  @IsOptional()
  @IsUUID('4', { message: 'patientId inválido' })
  patientId?: string;

  @IsOptional()
  @IsIn(IDENTITY_VERIFICATION_METHODS)
  identityVerificationMethod?: typeof IDENTITY_VERIFICATION_METHODS[number];

  @IsOptional()
  identityVerificationEvidence?: unknown;

  @IsOptional()
  @IsIn(['EN_REVISION'])
  status?: 'EN_REVISION';
}

export class ResolveDataRequestDto {
  @IsIn(['RESUELTA_ACEPTADA', 'RESUELTA_RECHAZADA'])
  status!: 'RESUELTA_ACEPTADA' | 'RESUELTA_RECHAZADA';

  @IsString()
  @MinLength(10, { message: 'resolutionNote debe tener al menos 10 caracteres' })
  @MaxLength(2000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  resolutionNote!: string;
}

export class ExtendDataRequestDto {
  @IsString()
  @MinLength(10, { message: 'Motivo de la prórroga debe tener al menos 10 caracteres' })
  @MaxLength(1000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  reason!: string;
}
