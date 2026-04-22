import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  PATIENT_NAME_MAX_LENGTH,
  PATIENT_NAME_MIN_LENGTH,
  PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH,
  PATIENT_RUT_MAX_LENGTH,
} from '../../../../shared/patient-field-constraints';

const toOptionalTrimmedString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export class CreatePatientQuickDto {
  @IsString()
  @MinLength(PATIENT_NAME_MIN_LENGTH, {
    message: `El nombre debe tener al menos ${PATIENT_NAME_MIN_LENGTH} caracteres`,
  })
  @MaxLength(PATIENT_NAME_MAX_LENGTH, {
    message: `El nombre no puede exceder ${PATIENT_NAME_MAX_LENGTH} caracteres`,
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  nombre: string;

  @IsString()
  @MaxLength(PATIENT_RUT_MAX_LENGTH, { message: `El RUT no puede exceder ${PATIENT_RUT_MAX_LENGTH} caracteres` })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  rut?: string;

  @IsBoolean()
  @IsOptional()
  rutExempt?: boolean;

  @IsString()
  @MaxLength(PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH, {
    message: `El motivo no puede exceder ${PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH} caracteres`,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  rutExemptReason?: string;
}
