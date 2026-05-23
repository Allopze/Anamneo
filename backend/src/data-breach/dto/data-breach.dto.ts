import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const DATA_BREACH_SEVERITIES = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const;
export const DATA_BREACH_STATUSES = ['ABIERTO', 'EN_EVALUACION', 'NOTIFICADO', 'CERRADO'] as const;

export class CreateDataBreachDto {
  @IsDateString({}, { message: 'detectedAt debe ser ISO date' })
  detectedAt!: string;

  @IsIn(DATA_BREACH_SEVERITIES)
  severity!: typeof DATA_BREACH_SEVERITIES[number];

  @IsString()
  @MinLength(10, { message: 'scope debe describir alcance (min 10 chars)' })
  @MaxLength(4000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  scope!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'affectedPatientIds debe contener UUIDs validos' })
  affectedPatientIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rootCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  containmentActions?: string;
}

export class AssessDataBreachDto {
  @IsString()
  @MinLength(20, { message: 'riskAssessment debe documentar la decision (min 20 chars)' })
  @MaxLength(4000)
  riskAssessment!: string;

  // Marca si el riesgo razonable amerita reporte a la Agencia (Art 14 sexies inciso 1).
  @IsOptional()
  @IsIn(['REPORTAR', 'NO_REPORTAR'])
  agencyDecision?: 'REPORTAR' | 'NO_REPORTAR';
}

export class NotifyAgencyDto {
  @IsOptional()
  @IsDateString()
  reportedAt?: string;
}

export class NotifySubjectsDto {
  @IsOptional()
  @IsDateString()
  notifiedAt?: string;

  // Mensaje libre para enviar al titular afectado (lenguaje claro y sencillo
  // segun Art 14 sexies inciso 3).
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  measuresTaken!: string;

  // ---- Campos recomendados para cumplir los 11 elementos minimos
  //      de notificacion (ver docs/respuestas-borrador-ley21719.md §3.3) ----

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsableName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dpoName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dpoEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dataCategoriesAffected?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  possibleConsequences?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendedActions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  consultationChannels?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  followUpInfo?: string;
}

export class CloseDataBreachDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  postMortem!: string;
}
