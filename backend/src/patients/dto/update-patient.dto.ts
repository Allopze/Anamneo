import {
	IsEmail,
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
import {
	PATIENT_ADDRESS_MAX_LENGTH,
	PATIENT_EMAIL_MAX_LENGTH,
	PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH,
	PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH,
	PATIENT_JOB_MAX_LENGTH,
	PATIENT_MEDICAL_CENTER_MAX_LENGTH,
	PATIENT_NAME_MAX_LENGTH,
	PATIENT_NAME_MIN_LENGTH,
	PATIENT_PHONE_MAX_LENGTH,
	PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH,
	PATIENT_RUT_MAX_LENGTH,
} from '../../../../shared/patient-field-constraints';

export class UpdatePatientDto {
	@IsString()
	@MaxLength(PATIENT_RUT_MAX_LENGTH, { message: `El RUT no puede exceder ${PATIENT_RUT_MAX_LENGTH} caracteres` })
	@IsOptional()
	rut?: string | null;

	@IsBoolean()
	@IsOptional()
	rutExempt?: boolean;

	@IsString()
	@MaxLength(PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH, {
		message: `El motivo no puede exceder ${PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH} caracteres`,
	})
	@IsOptional()
	rutExemptReason?: string | null;

	@IsString()
	@MinLength(PATIENT_NAME_MIN_LENGTH, {
		message: `El nombre debe tener al menos ${PATIENT_NAME_MIN_LENGTH} caracteres`,
	})
	@MaxLength(PATIENT_NAME_MAX_LENGTH, {
		message: `El nombre no puede exceder ${PATIENT_NAME_MAX_LENGTH} caracteres`,
	})
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
	@MaxLength(PATIENT_JOB_MAX_LENGTH, {
		message: `El trabajo no puede exceder ${PATIENT_JOB_MAX_LENGTH} caracteres`,
	})
	@IsOptional()
	trabajo?: string | null;

	@IsIn(PREVISIONES, { message: 'La previsión debe ser válida' })
	@IsOptional()
	prevision?: Prevision | null;

	@IsString()
	@MaxLength(PATIENT_ADDRESS_MAX_LENGTH, {
		message: `El domicilio no puede exceder ${PATIENT_ADDRESS_MAX_LENGTH} caracteres`,
	})
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsOptional()
	domicilio?: string | null;

	@IsString()
	@MaxLength(PATIENT_PHONE_MAX_LENGTH, {
		message: `El teléfono no puede exceder ${PATIENT_PHONE_MAX_LENGTH} caracteres`,
	})
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsOptional()
	telefono?: string | null;

	@IsEmail({}, { message: 'El email debe ser válido' })
	@MaxLength(PATIENT_EMAIL_MAX_LENGTH, {
		message: `El email no puede exceder ${PATIENT_EMAIL_MAX_LENGTH} caracteres`,
	})
	@Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
	@IsOptional()
	email?: string | null;

	@IsString()
	@MaxLength(PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH, {
		message: `El contacto de emergencia no puede exceder ${PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH} caracteres`,
	})
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsOptional()
	contactoEmergenciaNombre?: string | null;

	@IsString()
	@MaxLength(PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH, {
		message: `El teléfono de emergencia no puede exceder ${PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH} caracteres`,
	})
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsOptional()
	contactoEmergenciaTelefono?: string | null;

	@IsString()
	@MaxLength(PATIENT_MEDICAL_CENTER_MAX_LENGTH, {
		message: `El centro médico no puede exceder ${PATIENT_MEDICAL_CENTER_MAX_LENGTH} caracteres`,
	})
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsOptional()
	centroMedico?: string | null;
}
