import {
  IsString,
  IsArray,
  IsIn,
  IsOptional,
  IsNumber,
  IsUUID,
  ValidateNested,
  ValidateIf,
  MaxLength,
  ArrayMaxSize,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toTrimmedString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const toOptionalTrimmedString = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

class SuggestionItem {
  @IsOptional()
  @IsArray()
  reasons?: Array<{
    kind: 'NAME' | 'SYNONYM' | 'TAG';
    label: string;
    matchedValue: string;
    matches: string[];
  }>;

  @IsUUID(undefined, { message: 'Cada sugerencia debe incluir un id UUID válido' })
  id: string;

  @IsString()
  @Transform(({ value }) => toTrimmedString(value))
  @MinLength(1, { message: 'El nombre de la sugerencia no puede estar vacío' })
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
  @Transform(({ value }) => toTrimmedString(value))
  @MinLength(1, { message: 'El texto de entrada no puede estar vacío' })
  @MaxLength(2000)
  inputText: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @MinLength(1, { message: 'El snapshot no puede estar vacío' })
  @MaxLength(2000)
  persistedTextSnapshot?: string;

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
