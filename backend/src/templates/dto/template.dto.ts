import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

const TEMPLATE_CATEGORIES = ['GENERAL', 'SOAP', 'CONTROL_CRONICO', 'DERIVACION', 'RECETA'] as const;

export class CreateTemplateDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsIn([...TEMPLATE_CATEGORIES])
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(10000)
  content: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  sectionKey?: string;
}

export class UpdateTemplateDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @IsIn([...TEMPLATE_CATEGORIES])
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(10000)
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  sectionKey?: string;
}
