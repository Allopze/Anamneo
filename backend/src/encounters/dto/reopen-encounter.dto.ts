import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ENCOUNTER_REOPEN_REASON_CODES, type EncounterReopenReasonCode } from '../../../../shared/encounter-reopen-reasons';

export class ReopenEncounterDto {
  @IsString()
  @IsIn(ENCOUNTER_REOPEN_REASON_CODES)
  reasonCode: EncounterReopenReasonCode;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  note: string;
}
