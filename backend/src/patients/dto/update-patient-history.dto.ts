import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const PATIENT_HISTORY_TEXT_MAX_LENGTH = 4000;
const PATIENT_HISTORY_ITEM_MAX_LENGTH = 200;
const PATIENT_HISTORY_ITEMS_MAX_COUNT = 100;

const toOptionalTrimmedString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalNormalizedStringList = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  const seen = new Set<string>();
  const normalized: unknown[] = [];

  for (const item of value.slice(0, PATIENT_HISTORY_ITEMS_MAX_COUNT)) {
    if (typeof item !== 'string') {
      normalized.push(item);
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized.length > 0 ? normalized : undefined;
};

class PatientHistoryFieldDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString({ message: 'El historial clínico debe incluir texto válido' })
  @MaxLength(PATIENT_HISTORY_TEXT_MAX_LENGTH, {
    message: `El texto del historial clínico no puede exceder ${PATIENT_HISTORY_TEXT_MAX_LENGTH} caracteres`,
  })
  texto?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalNormalizedStringList(value))
  @IsArray({ message: 'El historial clínico debe incluir una lista válida' })
  @ArrayMaxSize(PATIENT_HISTORY_ITEMS_MAX_COUNT, {
    message: `La lista del historial clínico no puede exceder ${PATIENT_HISTORY_ITEMS_MAX_COUNT} elementos`,
  })
  @IsString({ each: true, message: 'La lista del historial clínico solo acepta texto' })
  @MaxLength(PATIENT_HISTORY_ITEM_MAX_LENGTH, {
    each: true,
    message: `Cada elemento del historial clínico no puede exceder ${PATIENT_HISTORY_ITEM_MAX_LENGTH} caracteres`,
  })
  items?: string[];
}

export class UpdatePatientHistoryDto {
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  antecedentesMedicos?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  antecedentesQuirurgicos?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  antecedentesGinecoobstetricos?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  antecedentesFamiliares?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  habitos?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  medicamentos?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  alergias?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  inmunizaciones?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  antecedentesSociales?: PatientHistoryFieldDto | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientHistoryFieldDto)
  antecedentesPersonales?: PatientHistoryFieldDto | null;
}
