import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RegisterDto } from './register.dto';

export class RegisterWithInvitationDto extends RegisterDto {
  @IsOptional()
  @IsString({ message: 'La invitación es inválida' })
  @MinLength(32, { message: 'La invitación es inválida' })
  invitationToken?: string;

  @IsOptional()
  @IsString({ message: 'El token de instalación es inválido' })
  @MinLength(16, { message: 'El token de instalación es inválido' })
  bootstrapToken?: string;

  @IsOptional()
  @IsString({ message: 'La versión de términos aceptada es inválida' })
  @MaxLength(32, { message: 'La versión de términos aceptada es inválida' })
  acceptedTermsVersion?: string;

  @IsOptional()
  @IsString({ message: 'La versión de privacidad aceptada es inválida' })
  @MaxLength(32, { message: 'La versión de privacidad aceptada es inválida' })
  acceptedPrivacyVersion?: string;
}
