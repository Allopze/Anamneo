import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsIn, MaxLength } from 'class-validator';

export const ALLERGY_SEVERITIES = ['LEVE', 'MODERADA', 'GRAVE', 'FATAL'] as const;
export type AllergySeverity = typeof ALLERGY_SEVERITIES[number];

export class CreateAllergyDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  allergen: string;

  @IsIn(ALLERGY_SEVERITIES)
  @IsOptional()
  severity?: AllergySeverity;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reactionType?: string;

  @IsISO8601()
  @IsOptional()
  onsetDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

export class UpdateAllergyDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  allergen?: string;

  @IsIn(ALLERGY_SEVERITIES)
  @IsOptional()
  severity?: AllergySeverity;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reactionType?: string;

  @IsISO8601()
  @IsOptional()
  onsetDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
