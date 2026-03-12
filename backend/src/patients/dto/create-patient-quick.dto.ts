import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePatientQuickDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  nombre: string;

  @IsString()
  @MaxLength(20, { message: 'El RUT no puede exceder 20 caracteres' })
  @IsOptional()
  rut?: string;

  @IsBoolean()
  @IsOptional()
  rutExempt?: boolean;

  @IsString()
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
  @IsOptional()
  rutExemptReason?: string;
}
