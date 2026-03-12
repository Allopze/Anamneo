import { IsString, IsArray, IsOptional, MinLength, MaxLength, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateConditionDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(300, { message: 'El nombre no puede exceder 300 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50, { message: 'No puede tener más de 50 sinónimos' })
  @IsOptional()
  synonyms?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30, { message: 'No puede tener más de 30 tags' })
  @IsOptional()
  tags?: string[];
}
