import { Transform } from 'class-transformer';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
  IsObject,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const SECTION_NOT_APPLICABLE_REASON_MIN_LENGTH = 10;
const SECTION_NOT_APPLICABLE_REASON_MAX_LENGTH = 1000;
const SECTION_DATA_MAX_TOP_LEVEL_KEYS = 120;
const SECTION_DATA_MAX_SERIALIZED_LENGTH = 120_000;

@ValidatorConstraint({ name: 'sectionDataPayload', async: false })
class SectionDataPayloadConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }

    const record = value as Record<string, unknown>;
    if (Object.keys(record).length > SECTION_DATA_MAX_TOP_LEVEL_KEYS) {
      return false;
    }

    try {
      const serialized = JSON.stringify(record);
      return serialized.length <= SECTION_DATA_MAX_SERIALIZED_LENGTH;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    const value = args.value;

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'Los datos de la sección deben enviarse como un objeto válido';
    }

    const topLevelKeyCount = Object.keys(value as Record<string, unknown>).length;
    if (topLevelKeyCount > SECTION_DATA_MAX_TOP_LEVEL_KEYS) {
      return `Los datos de la sección no pueden exceder ${SECTION_DATA_MAX_TOP_LEVEL_KEYS} campos de primer nivel`;
    }

    return `Los datos de la sección no pueden exceder ${SECTION_DATA_MAX_SERIALIZED_LENGTH} caracteres`;
  }
}

const toOptionalTrimmedString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class UpdateSectionDto {
  @IsObject()
  @Validate(SectionDataPayloadConstraint)
  data: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  baseUpdatedAt?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsBoolean()
  @IsOptional()
  notApplicable?: boolean;

  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((object) => object.notApplicable === true || object.notApplicableReason !== undefined)
  @IsString()
  @MinLength(SECTION_NOT_APPLICABLE_REASON_MIN_LENGTH, {
    message: `El motivo debe tener al menos ${SECTION_NOT_APPLICABLE_REASON_MIN_LENGTH} caracteres`,
  })
  @MaxLength(SECTION_NOT_APPLICABLE_REASON_MAX_LENGTH, {
    message: `El motivo no puede exceder ${SECTION_NOT_APPLICABLE_REASON_MAX_LENGTH} caracteres`,
  })
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
