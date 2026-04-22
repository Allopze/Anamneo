import { IsString, MaxLength, MinLength } from 'class-validator';

const SIGN_ENCOUNTER_PASSWORD_MAX_LENGTH = 72;

export class SignEncounterDto {
  @IsString()
  @MinLength(1, { message: 'Debe ingresar su contraseña para firmar' })
  @MaxLength(SIGN_ENCOUNTER_PASSWORD_MAX_LENGTH, {
    message: `La contraseña no puede exceder ${SIGN_ENCOUNTER_PASSWORD_MAX_LENGTH} caracteres`,
  })
  password: string;
}
