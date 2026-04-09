import { IsString, MinLength } from 'class-validator';

export class SignEncounterDto {
  @IsString()
  @MinLength(1, { message: 'Debe ingresar su contraseña para firmar' })
  password: string;
}
