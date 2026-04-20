import { IsDateString, IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Prevision, PREVISIONES, Sexo, SEXOS } from '../../common/types';
import {
  PATIENT_ADDRESS_MAX_LENGTH,
  PATIENT_JOB_MAX_LENGTH,
  PATIENT_MEDICAL_CENTER_MAX_LENGTH,
} from '../../../../shared/patient-field-constraints';

export class UpdatePatientAdminDto {
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

  @IsIn(PREVISIONES, { message: 'La previsión debe ser válida' })
  @IsOptional()
  prevision?: Prevision | null;

  @IsString()
  @MaxLength(PATIENT_JOB_MAX_LENGTH, { message: `El trabajo no puede exceder ${PATIENT_JOB_MAX_LENGTH} caracteres` })
  @IsOptional()
  trabajo?: string | null;

  @IsString()
  @MaxLength(PATIENT_ADDRESS_MAX_LENGTH, { message: `El domicilio no puede exceder ${PATIENT_ADDRESS_MAX_LENGTH} caracteres` })
  @IsOptional()
  domicilio?: string | null;

  @IsString()
  @MaxLength(PATIENT_MEDICAL_CENTER_MAX_LENGTH, {
    message: `El centro médico no puede exceder ${PATIENT_MEDICAL_CENTER_MAX_LENGTH} caracteres`,
  })
  @IsOptional()
  centroMedico?: string | null;
}
