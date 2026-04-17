import { IsObject, IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSectionDto {
  @IsObject()
  data: Record<string, any>;

  @IsDateString()
  @IsOptional()
  baseUpdatedAt?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsBoolean()
  @IsOptional()
  notApplicable?: boolean;

  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  notApplicableReason?: string;
}

// Valid section keys for param validation
export const VALID_SECTION_KEYS = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'ANAMNESIS_PROXIMA',
  'ANAMNESIS_REMOTA',
  'REVISION_SISTEMAS',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
  'RESPUESTA_TRATAMIENTO',
  'OBSERVACIONES',
] as const;
