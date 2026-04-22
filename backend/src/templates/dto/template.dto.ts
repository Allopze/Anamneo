import { Transform } from 'class-transformer';
import { IsString, IsOptional, MaxLength, IsIn, MinLength } from 'class-validator';

const TEMPLATE_CATEGORIES = ['GENERAL', 'SOAP', 'CONTROL_CRONICO', 'DERIVACION', 'RECETA'] as const;

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

export class CreateTemplateDto {
  @IsString()
  @Transform(({ value }) => toTrimmedString(value))
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(200)
  name: string;

  @IsIn([...TEMPLATE_CATEGORIES])
  @IsOptional()
  category?: string;

  @IsString()
  @Transform(({ value }) => toTrimmedString(value))
  @MinLength(1, { message: 'El contenido no puede estar vacío' })
  @MaxLength(10000)
  content: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @MinLength(1, { message: 'La sección no puede estar vacía' })
  @MaxLength(50)
  sectionKey?: string;
}

export class UpdateTemplateDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  name?: string;

  @IsIn([...TEMPLATE_CATEGORIES])
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(10000)
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @MinLength(1, { message: 'El contenido no puede estar vacío' })
  content?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @MinLength(1, { message: 'La sección no puede estar vacía' })
  @MaxLength(50)
  sectionKey?: string;
}
