import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MailService } from './mail.service';

class SendTestInvitationEmailDto {
  @IsEmail({}, { message: 'Debe ingresar un correo válido para la prueba' })
  email: string;

  @IsString() @MaxLength(200) @IsOptional() clinicName?: string;
  @IsUrl({ require_tld: false }, { message: 'Debe ingresar una URL pública válida' }) @MaxLength(300) @IsOptional() appPublicUrl?: string;
  @IsString() @MaxLength(200) @IsOptional() smtpHost?: string;
  @Matches(/^\d{1,5}$/, { message: 'El puerto SMTP debe ser numérico' }) @IsOptional() smtpPort?: string;
  @IsBoolean() @IsOptional() smtpSecure?: boolean;
  @IsString() @MaxLength(200) @IsOptional() smtpUser?: string;
  @IsString() @MaxLength(500) @IsOptional() smtpPassword?: string;
  @IsEmail({}, { message: 'El correo remitente SMTP no es válido' }) @MaxLength(200) @IsOptional() smtpFromEmail?: string;
  @IsString() @MaxLength(200) @IsOptional() smtpFromName?: string;
  @IsString() @MaxLength(50000) @IsOptional() invitationTemplateHtml?: string;
  @IsString() @MaxLength(300) @IsOptional() invitationSubject?: string;
}

@Controller('mail')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test-invitation')
  @Roles('ADMIN')
  sendTestInvitation(@Body() dto: SendTestInvitationEmailDto) {
    return this.mailService.sendTestInvitationEmail(dto.email, dto);
  }
}