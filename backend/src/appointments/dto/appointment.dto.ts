import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const STATUSES = ['PROGRAMADA', 'CONFIRMADA', 'NO_SHOW', 'ATENDIDA', 'CANCELADA'] as const;

export class CreateAppointmentDto {
  @IsString()
  @IsUUID()
  medicoId: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  patientId?: string;

  @IsString()
  @IsDateString()
  startAt: string;

  @IsString()
  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsString()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsString()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
