import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const CLINICAL_ANALYTICS_SOURCES = ['ANY', 'AFECCION_PROBABLE', 'SOSPECHA_DIAGNOSTICA'] as const;
export const CLINICAL_ANALYTICS_FILTER_TEXT_MAX_LENGTH = 300;

export type ClinicalAnalyticsSource = (typeof CLINICAL_ANALYTICS_SOURCES)[number];

function toOptionalTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
}

export class ClinicalAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(CLINICAL_ANALYTICS_FILTER_TEXT_MAX_LENGTH, {
    message: `El filtro no puede exceder ${CLINICAL_ANALYTICS_FILTER_TEXT_MAX_LENGTH} caracteres`,
  })
  @Transform(({ value }) => toOptionalTrimmedString(value))
  condition?: string;

  @IsOptional()
  @IsIn(CLINICAL_ANALYTICS_SOURCES)
  source: ClinicalAnalyticsSource = 'ANY';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(7)
  @Max(365)
  followUpDays: number = 30;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(3)
  @Max(25)
  limit: number = 10;
}