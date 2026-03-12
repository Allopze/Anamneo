import { IsObject, IsBoolean, IsOptional } from 'class-validator';

export class UpdateSectionDto {
  @IsObject()
  data: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
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
