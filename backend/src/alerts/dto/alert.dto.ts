import { IsString, IsOptional, IsIn } from 'class-validator';

const ALERT_TYPES = ['ALERGIA', 'INTERACCION_MEDICAMENTOS', 'SIGNOS_VITALES', 'RESULTADO_CRITICO', 'GENERAL'] as const;
const ALERT_SEVERITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export class CreateAlertDto {
  @IsString()
  patientId: string;

  @IsOptional()
  @IsString()
  encounterId?: string;

  @IsIn(ALERT_TYPES)
  type: string;

  @IsIn(ALERT_SEVERITIES)
  severity: string;

  @IsString()
  title: string;

  @IsString()
  message: string;
}
