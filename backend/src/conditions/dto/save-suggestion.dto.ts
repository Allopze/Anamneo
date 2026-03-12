import { IsString, IsArray, IsIn, IsOptional, IsNumber, IsUUID, ValidateNested, ValidateIf, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class SuggestionItem {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  score: number;

  @IsNumber()
  confidence: number;
}

export class SaveSuggestionDto {
  @IsString()
  @MaxLength(2000)
  inputText: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestionItem)
  suggestions: SuggestionItem[];

  @ValidateIf((o) => o.chosenConditionId !== null)
  @IsUUID(undefined, { message: 'chosenConditionId debe ser un UUID válido' })
  @IsOptional()
  chosenConditionId: string | null;

  @IsIn(['AUTO', 'MANUAL'], { message: 'chosenMode debe ser AUTO o MANUAL' })
  chosenMode: 'AUTO' | 'MANUAL';
}
