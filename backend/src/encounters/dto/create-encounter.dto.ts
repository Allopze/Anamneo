import { IsOptional, IsUUID } from 'class-validator';

export class CreateEncounterDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'duplicateFromEncounterId debe ser un UUID válido' })
  duplicateFromEncounterId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'appointmentId debe ser un UUID válido' })
  appointmentId?: string;
}
