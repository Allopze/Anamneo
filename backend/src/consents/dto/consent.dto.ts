import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const CONSENT_TYPES = ['TRATAMIENTO', 'DATOS_PERSONALES', 'PROCEDIMIENTO', 'INVESTIGACION'] as const;

export class CreateConsentDto {
  @IsUUID('4', { message: 'El paciente debe ser válido' })
  patientId: string;

  @IsOptional()
  @IsUUID('4', { message: 'La atención debe ser válida' })
  encounterId?: string;

  @IsIn(CONSENT_TYPES)
  type: string;

  @IsString()
  @MinLength(2, { message: 'La descripción debe tener al menos 2 caracteres' })
  @MaxLength(1000, { message: 'La descripción no puede exceder 1000 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  description: string;
}

export class RevokeConsentDto {
  @IsString()
  @MinLength(2, { message: 'El motivo debe tener al menos 2 caracteres' })
  @MaxLength(1000, { message: 'El motivo no puede exceder 1000 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  reason: string;
}
