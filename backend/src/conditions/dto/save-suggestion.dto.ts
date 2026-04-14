import { IsString, IsArray, IsIn, IsOptional, IsNumber, IsUUID, ValidateNested, ValidateIf, MaxLength, ArrayMaxSize, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class SuggestionItem {
  @IsUUID(undefined, { message: 'Cada sugerencia debe incluir un id UUID válido' })
  id: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  confidence: number;
}

export class SaveSuggestionDto {
  @IsString()
  @MaxLength(2000)
  inputText: string;

  @IsArray()
  @ArrayMaxSize(10)
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
