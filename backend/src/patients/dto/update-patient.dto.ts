import {
	IsBoolean,
	IsDateString,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
	PREVISIONES,
	Prevision,
	SEXOS,
	Sexo,
} from '../../common/types';

export class UpdatePatientDto {
	@IsString()
	@MaxLength(20, { message: 'El RUT no puede exceder 20 caracteres' })
	@IsOptional()
	rut?: string | null;

	@IsBoolean()
	@IsOptional()
	rutExempt?: boolean;

	@IsString()
	@MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
	@IsOptional()
	rutExemptReason?: string | null;

	@IsString()
	@MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
	@MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsOptional()
	nombre?: string;

	@IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida' })
	@IsOptional()
	fechaNacimiento?: string | null;

	@IsInt()
	@Min(0, { message: 'La edad debe ser mayor a 0' })
	@Max(150, { message: 'La edad no puede ser mayor a 150' })
	@IsOptional()
	edad?: number | null;

	@IsInt()
	@Min(0)
	@Max(11)
	@IsOptional()
	edadMeses?: number | null;

	@IsIn(SEXOS, { message: 'El sexo debe ser válido' })
	@IsOptional()
	sexo?: Sexo | null;

	@IsString()
	@MaxLength(200, { message: 'El trabajo no puede exceder 200 caracteres' })
	@IsOptional()
	trabajo?: string | null;

	@IsIn(PREVISIONES, { message: 'La previsión debe ser válida' })
	@IsOptional()
	prevision?: Prevision | null;

	@IsString()
	@MaxLength(500, { message: 'El domicilio no puede exceder 500 caracteres' })
	@IsOptional()
	domicilio?: string | null;

	@IsString()
	@MaxLength(200, { message: 'El centro médico no puede exceder 200 caracteres' })
	@IsOptional()
	centroMedico?: string | null;
}
