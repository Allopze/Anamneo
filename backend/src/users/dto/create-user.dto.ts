import { IsEmail, IsString, MinLength, MaxLength, Matches, IsIn, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role, ROLES } from '../../common/types';

export class CreateUserDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener mayúscula, minúscula y número',
  })
  @Matches(/^\S+$/, {
    message: 'La contraseña no puede contener espacios',
  })
  password: string;

  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  nombre: string;

  @IsIn(ROLES, { message: 'El rol debe ser MEDICO, ASISTENTE o ADMIN' })
  @IsOptional()
  role?: Role;

  @IsUUID(undefined, { message: 'medicoId debe ser un UUID válido' })
  @IsOptional()
  medicoId?: string;
}

