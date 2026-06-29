import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ENCOUNTER_REVIEW_STATUSES } from '../../common/types';

const REVIEW_STATUS_NOTE_MAX_LENGTH = 500;
const REVIEW_STATUS_REQUIRED_NOTE_MIN_LENGTH = 10;

function toOptionalTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class UpdateReviewStatusDto {
  @IsString()
  @IsIn(ENCOUNTER_REVIEW_STATUSES)
  reviewStatus: (typeof ENCOUNTER_REVIEW_STATUSES)[number];

  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((object) => object.reviewStatus === 'REVISADA_POR_MEDICO' || object.note !== undefined)
  @IsString()
  @MinLength(REVIEW_STATUS_REQUIRED_NOTE_MIN_LENGTH, {
    message: `La nota de revisión debe tener al menos ${REVIEW_STATUS_REQUIRED_NOTE_MIN_LENGTH} caracteres`,
  })
  @MaxLength(REVIEW_STATUS_NOTE_MAX_LENGTH, {
    message: `La nota de revisión no puede exceder ${REVIEW_STATUS_NOTE_MAX_LENGTH} caracteres`,
  })
  note?: string;
}
