import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ENCOUNTER_TASK_PRIORITIES,
  ENCOUNTER_TASK_STATUSES,
  ENCOUNTER_TASK_TYPES,
} from '../../common/types';

export class UpdatePatientTaskStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(ENCOUNTER_TASK_STATUSES)
  status?: (typeof ENCOUNTER_TASK_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  details?: string;

  @IsOptional()
  @IsString()
  @IsIn(ENCOUNTER_TASK_TYPES)
  type?: (typeof ENCOUNTER_TASK_TYPES)[number];

  @IsOptional()
  @IsString()
  @IsIn(ENCOUNTER_TASK_PRIORITIES)
  priority?: (typeof ENCOUNTER_TASK_PRIORITIES)[number];

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
