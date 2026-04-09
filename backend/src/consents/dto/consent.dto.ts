import { IsString, IsOptional, IsIn } from 'class-validator';

const CONSENT_TYPES = ['TRATAMIENTO', 'DATOS_PERSONALES', 'PROCEDIMIENTO', 'INVESTIGACION'] as const;

export class CreateConsentDto {
  @IsString()
  patientId: string;

  @IsOptional()
  @IsString()
  encounterId?: string;

  @IsIn(CONSENT_TYPES)
  type: string;

  @IsString()
  description: string;
}

export class RevokeConsentDto {
  @IsString()
  reason: string;
}
