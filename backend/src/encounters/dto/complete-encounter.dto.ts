import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const toTrimmedString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class CompleteEncounterDto {
  @IsOptional()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MinLength(10, { message: 'La nota de cierre debe tener al menos 10 caracteres' })
  @MaxLength(1000)
  closureNote?: string;
}
