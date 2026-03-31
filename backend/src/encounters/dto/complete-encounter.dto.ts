import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteEncounterDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  closureNote?: string;
}
