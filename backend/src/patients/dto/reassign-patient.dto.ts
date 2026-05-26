import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import {
  REASSIGNMENT_REASON_MAX_LENGTH,
  REASSIGNMENT_REASON_MIN_LENGTH,
} from '../../../../shared/reassignment-contract';

export class ReassignPatientDto {
  @IsUUID()
  targetMedicoId!: string;

  @IsString()
  @MinLength(REASSIGNMENT_REASON_MIN_LENGTH)
  @MaxLength(REASSIGNMENT_REASON_MAX_LENGTH)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  includeOpenEncounters?: boolean;
}
