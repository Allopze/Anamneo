import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;
}

export class ConfirmPasswordResetDto {
  @IsString({ message: 'El token es inválido' })
  @MinLength(32, { message: 'El token es inválido' })
  @MaxLength(128, { message: 'El token es inválido' })
  token: string;

  @IsString({ message: 'Debe ingresar una contraseña' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener mayúscula, minúscula y número',
  })
  @Matches(/^\S+$/, { message: 'La contraseña no puede contener espacios' })
  newPassword: string;

  @IsOptional()
  @IsString({ message: 'El código 2FA es inválido' })
  @MaxLength(16, { message: 'El código 2FA es inválido' })
  totpCode?: string;
}
