import {
  IsString,
  IsInt,
  IsIn,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Sexo, Prevision, SEXOS, PREVISIONES } from '../../common/types';

export class CreatePatientDto {
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

  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  nombre: string;

  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida' })
  @IsOptional()
  fechaNacimiento?: string;

  @IsInt()
  @Min(0, { message: 'La edad debe ser mayor a 0' })
  @Max(150, { message: 'La edad no puede ser mayor a 150' })
  edad: number;

  @IsInt()
  @Min(0)
  @Max(11)
  @IsOptional()
  edadMeses?: number;

  @IsIn(SEXOS, { message: 'El sexo debe ser válido' })
  sexo: Sexo;

  @IsString()
  @MaxLength(200, { message: 'El trabajo no puede exceder 200 caracteres' })
  @IsOptional()
  trabajo?: string;

  @IsIn(PREVISIONES, { message: 'La previsión debe ser válida' })
  prevision: Prevision;

  @IsString()
  @MaxLength(500, { message: 'El domicilio no puede exceder 500 caracteres' })
  @IsOptional()
  domicilio?: string;

  @IsString()
  @MaxLength(200, { message: 'El centro médico no puede exceder 200 caracteres' })
  @IsOptional()
  centroMedico?: string;
}

