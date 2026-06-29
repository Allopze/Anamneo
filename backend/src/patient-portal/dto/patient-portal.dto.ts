import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export const PATIENT_PORTAL_RELATIONSHIPS = [
  'TITULAR',
  'PADRE',
  'MADRE',
  'TUTOR',
  'REPRESENTANTE',
] as const;

export class PortalInviteDto {
  @IsEmail({}, { message: 'email debe ser válido' })
  @MaxLength(255)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;

  @IsIn(PATIENT_PORTAL_RELATIONSHIPS)
  relationship!: typeof PATIENT_PORTAL_RELATIONSHIPS[number];
}

export class PortalActivateDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener mayúscula, minúscula y número',
  })
  @Matches(/^\S+$/, { message: 'La contraseña no puede contener espacios' })
  password!: string;

  @IsBoolean()
  acceptPrivacy!: boolean;

  @IsBoolean()
  acceptTerms!: boolean;
}

export class PortalLoginDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

export class PortalRequestPasswordResetDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;
}

export class PortalResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener mayúscula, minúscula y número',
  })
  @Matches(/^\S+$/, { message: 'La contraseña no puede contener espacios' })
  password!: string;
}

export class PortalDataRequestDto {
  @IsIn(['ACCESO', 'RECTIFICACION', 'SUPRESION', 'OPOSICION', 'PORTABILIDAD', 'BLOQUEO'])
  requestType!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  payloadRequest!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  requesterRut?: string;
}
