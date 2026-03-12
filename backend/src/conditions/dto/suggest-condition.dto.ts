import { IsString, IsInt, IsOptional, Min, Max, MinLength, MaxLength } from 'class-validator';

export class SuggestConditionDto {
  @IsString()
  @MinLength(3, { message: 'El texto debe tener al menos 3 caracteres' })
  @MaxLength(1000, { message: 'El texto no puede exceder 1000 caracteres' })
  text: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  limit?: number;
}
