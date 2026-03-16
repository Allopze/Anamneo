import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ENCOUNTER_REVIEW_STATUSES } from '../../common/types';

export class UpdateReviewStatusDto {
  @IsString()
  @IsIn(ENCOUNTER_REVIEW_STATUSES)
  reviewStatus: (typeof ENCOUNTER_REVIEW_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
