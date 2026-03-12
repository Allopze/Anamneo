import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString()
  @MinLength(1, { message: 'La contraseña es requerida' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  password: string;
}
