import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PATIENT_PROBLEM_STATUSES } from '../../common/types';

export class UpsertPatientProblemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  label: string;

  @IsOptional()
  @IsString()
  @IsIn(PATIENT_PROBLEM_STATUSES)
  status?: (typeof PATIENT_PROBLEM_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  severity?: string;

  @IsOptional()
  @IsDateString()
  onsetDate?: string;

  @IsOptional()
  @IsString()
  encounterId?: string;
}
