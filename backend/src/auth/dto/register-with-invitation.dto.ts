import { IsOptional, IsString, MinLength } from 'class-validator';
import { RegisterDto } from './register.dto';

export class RegisterWithInvitationDto extends RegisterDto {
  @IsOptional()
  @IsString({ message: 'La invitación es inválida' })
  @MinLength(32, { message: 'La invitación es inválida' })
  invitationToken?: string;
}
