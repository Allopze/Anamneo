import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import {
  CLINICAL_ANALYTICS_FILTER_TEXT_MAX_LENGTH,
  CLINICAL_ANALYTICS_SOURCES,
  type ClinicalAnalyticsSource,
} from './clinical-analytics-query.dto';

export const CLINICAL_ANALYTICS_CASE_FOCUS_TYPES = ['MEDICATION', 'SYMPTOM'] as const;

export type ClinicalAnalyticsCaseFocusType = (typeof CLINICAL_ANALYTICS_CASE_FOCUS_TYPES)[number];

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

export class ClinicalAnalyticsCasesQueryDto {
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

  @ValidateIf((object) => object.focusType !== undefined || object.focusValue !== undefined)
  @IsIn(CLINICAL_ANALYTICS_CASE_FOCUS_TYPES)
  focusType?: ClinicalAnalyticsCaseFocusType;

  @ValidateIf((object) => object.focusType !== undefined || object.focusValue !== undefined)
  @IsString()
  @MaxLength(CLINICAL_ANALYTICS_FILTER_TEXT_MAX_LENGTH, {
    message: `El filtro de foco no puede exceder ${CLINICAL_ANALYTICS_FILTER_TEXT_MAX_LENGTH} caracteres`,
  })
  @Transform(({ value }) => toOptionalTrimmedString(value))
  focusValue?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(5)
  @Max(50)
  pageSize: number = 15;
}