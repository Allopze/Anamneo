import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsIn, MaxLength } from 'class-validator';

export const MEDICATION_STATUSES = ['ACTIVO', 'SUSPENDIDO'] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

export class CreatePatientMedicationDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  drug: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  dose?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  route?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  frequency?: string;

  @IsIn(MEDICATION_STATUSES)
  @IsOptional()
  status?: MedicationStatus;

  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

export class UpdatePatientMedicationDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  drug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  dose?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  route?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  frequency?: string;

  @IsIn(MEDICATION_STATUSES)
  @IsOptional()
  status?: MedicationStatus;

  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
