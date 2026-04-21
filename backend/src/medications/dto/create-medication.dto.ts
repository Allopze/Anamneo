import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const MEDICATION_DEFAULT_ROUTES = [
  'ORAL',
  'IV',
  'IM',
  'SC',
  'TOPICA',
  'INHALATORIA',
  'RECTAL',
  'SUBLINGUAL',
  'OFTALMICA',
  'OTRA',
] as const;

const trimOptionalMedicationValue = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export class CreateMedicationDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(300, { message: 'El nombre no puede exceder 300 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @MinLength(2, { message: 'El principio activo debe tener al menos 2 caracteres' })
  @MaxLength(300, { message: 'El principio activo no puede exceder 300 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  activeIngredient: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'La dosis sugerida no puede exceder 120 caracteres' })
  @Transform(trimOptionalMedicationValue)
  defaultDose?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(MEDICATION_DEFAULT_ROUTES, { message: 'La vía sugerida no es válida' })
  @Transform(trimOptionalMedicationValue)
  defaultRoute?: (typeof MEDICATION_DEFAULT_ROUTES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'La frecuencia sugerida no puede exceder 120 caracteres' })
  @Transform(trimOptionalMedicationValue)
  defaultFrequency?: string | null;
}