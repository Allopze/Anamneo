import { IsEmail, IsString, MinLength, MaxLength, Matches, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../common/types';

export { Role };

const REGISTERABLE_ROLES = ['MEDICO'] as const;

export class RegisterDto {
  @IsEmail({}, { message: 'Debe ingresar un email válido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString({ message: 'Debe ingresar una contraseña' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]+$/, {
    message: 'La contraseña debe contener mayúscula, minúscula y número',
  })
  password: string;

  @IsString({ message: 'Debe ingresar un nombre' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  nombre: string;

  @IsIn([...REGISTERABLE_ROLES], { message: 'Rol inválido. Solo se permite: MEDICO' })
  @IsOptional()
  role?: Role;
}
