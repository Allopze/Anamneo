import { IsOptional, IsObject } from 'class-validator';

export class UpdatePatientHistoryDto {
  @IsObject()
  @IsOptional()
  antecedentesMedicos?: Record<string, any>;

  @IsObject()
  @IsOptional()
  antecedentesQuirurgicos?: Record<string, any>;

  @IsObject()
  @IsOptional()
  antecedentesGinecoobstetricos?: Record<string, any>;

  @IsObject()
  @IsOptional()
  antecedentesFamiliares?: Record<string, any>;

  @IsObject()
  @IsOptional()
  habitos?: Record<string, any>;

  @IsObject()
  @IsOptional()
  medicamentos?: Record<string, any>;

  @IsObject()
  @IsOptional()
  alergias?: Record<string, any>;

  @IsObject()
  @IsOptional()
  inmunizaciones?: Record<string, any>;

  @IsObject()
  @IsOptional()
  antecedentesSociales?: Record<string, any>;

  @IsObject()
  @IsOptional()
  antecedentesPersonales?: Record<string, any>;
}
