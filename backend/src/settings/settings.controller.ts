import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

class UpdateSettingsDto {
  @IsString() @MaxLength(200) @IsOptional() clinicName?: string;
  @IsString() @MaxLength(500) @IsOptional() clinicAddress?: string;
  @IsString() @MaxLength(50) @IsOptional() clinicPhone?: string;
  @IsString() @MaxLength(200) @IsOptional() clinicEmail?: string;
  @IsUrl({ require_tld: false }, { message: 'Debe ingresar una URL pública válida' }) @MaxLength(300) @IsOptional() appPublicUrl?: string;
  @IsString() @MaxLength(200) @IsOptional() smtpHost?: string;
  @Matches(/^\d{1,5}$/, { message: 'El puerto SMTP debe ser numérico' }) @IsOptional() smtpPort?: string;
  @IsBoolean() @IsOptional() smtpSecure?: boolean;
  @IsString() @MaxLength(200) @IsOptional() smtpUser?: string;
  @IsString() @MaxLength(500) @IsOptional() smtpPassword?: string;
  @IsEmail({}, { message: 'El correo remitente SMTP no es válido' }) @MaxLength(200) @IsOptional() smtpFromEmail?: string;
  @IsString() @MaxLength(200) @IsOptional() smtpFromName?: string;
  @IsString() @MaxLength(300) @IsOptional() invitationSubject?: string;
  @IsString() @MaxLength(50000) @IsOptional() invitationTemplateHtml?: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('ADMIN')
  getAll() {
    return this.settingsService.getAllAdminView();
  }

  @Put()
  @Roles('ADMIN')
  update(@Body() dto: UpdateSettingsDto) {
    const data: Record<string, string> = {};
    if (dto.clinicName !== undefined) data['clinic.name'] = dto.clinicName;
    if (dto.clinicAddress !== undefined) data['clinic.address'] = dto.clinicAddress;
    if (dto.clinicPhone !== undefined) data['clinic.phone'] = dto.clinicPhone;
    if (dto.clinicEmail !== undefined) data['clinic.email'] = dto.clinicEmail;
    if (dto.appPublicUrl !== undefined) data['app.publicUrl'] = dto.appPublicUrl;
    if (dto.smtpHost !== undefined) data['smtp.host'] = dto.smtpHost;
    if (dto.smtpPort !== undefined) data['smtp.port'] = dto.smtpPort;
    if (dto.smtpSecure !== undefined) data['smtp.secure'] = String(dto.smtpSecure);
    if (dto.smtpUser !== undefined) data['smtp.user'] = dto.smtpUser;
    if (dto.smtpPassword !== undefined) data['smtp.password'] = dto.smtpPassword;
    if (dto.smtpFromEmail !== undefined) data['smtp.fromEmail'] = dto.smtpFromEmail;
    if (dto.smtpFromName !== undefined) data['smtp.fromName'] = dto.smtpFromName;
    if (dto.invitationSubject !== undefined) data['email.invitationSubject'] = dto.invitationSubject;
    if (dto.invitationTemplateHtml !== undefined) data['email.invitationTemplateHtml'] = dto.invitationTemplateHtml;
    return this.settingsService.setMany(data);
  }
}
