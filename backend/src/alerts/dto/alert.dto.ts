import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const ALERT_TYPES = ['ALERGIA', 'INTERACCION_MEDICAMENTOS', 'SIGNOS_VITALES', 'RESULTADO_CRITICO', 'GENERAL'] as const;
const ALERT_SEVERITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export class CreateAlertDto {
  @IsUUID('4', { message: 'El paciente debe ser válido' })
  patientId: string;

  @IsOptional()
  @IsUUID('4', { message: 'La atención debe ser válida' })
  encounterId?: string;

  @IsIn(ALERT_TYPES)
  type: string;

  @IsIn(ALERT_SEVERITIES)
  severity: string;

  @IsString()
  @MinLength(2, { message: 'El título debe tener al menos 2 caracteres' })
  @MaxLength(160, { message: 'El título no puede exceder 160 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  title: string;

  @IsString()
  @MinLength(2, { message: 'El mensaje debe tener al menos 2 caracteres' })
  @MaxLength(1200, { message: 'El mensaje no puede exceder 1200 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  message: string;
}
