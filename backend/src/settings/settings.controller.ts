import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,  ValidateIf,} from 'class-validator';

class UpdateSettingsDto {
  @IsString() @MaxLength(200) @IsOptional() clinicName?: string;
  @IsString() @MaxLength(500) @IsOptional() clinicAddress?: string;
  @IsString() @MaxLength(50) @IsOptional() clinicPhone?: string;
  @IsString() @MaxLength(200) @IsOptional() clinicEmail?: string;
  @ValidateIf((_, value) => value !== '')
  @IsUrl({ require_tld: false }, { message: 'Debe ingresar una URL pública válida' }) @MaxLength(300) @IsOptional() appPublicUrl?: string;
  @IsString() @MaxLength(200) @IsOptional() smtpHost?: string;
  @ValidateIf((_, value) => value !== '')
  @Matches(/^\d{1,5}$/, { message: 'El puerto SMTP debe ser numérico' }) @IsOptional() smtpPort?: string;
  @IsBoolean() @IsOptional() smtpSecure?: boolean;
  @IsString() @MaxLength(200) @IsOptional() smtpUser?: string;
  @IsString() @MaxLength(500) @IsOptional() smtpPassword?: string;
  @ValidateIf((_, value) => value !== '')
  @IsEmail({}, { message: 'El correo remitente SMTP no es válido' }) @MaxLength(200) @IsOptional() smtpFromEmail?: string;
  @IsString() @MaxLength(200) @IsOptional() smtpFromName?: string;
  @IsString() @MaxLength(300) @IsOptional() invitationSubject?: string;
  @IsString() @MaxLength(50000) @IsOptional() invitationTemplateHtml?: string;
  @IsInt({ message: 'El tiempo de inactividad debe ser un número entero de minutos' })
  @Min(5, { message: 'El tiempo de inactividad mínimo es 5 minutos' })
  @Max(240, { message: 'El tiempo de inactividad máximo es 240 minutos' })
  @IsOptional()
  sessionInactivityTimeoutMinutes?: number;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Roles('ADMIN')
  getAll() {
    return this.settingsService.getAllAdminView();
  }

  @Get('session-policy')
  getSessionPolicy() {
    return this.settingsService.getSessionPolicy();
  }

  @Put()
  @Roles('ADMIN')
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: CurrentUserData) {
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
    if (dto.sessionInactivityTimeoutMinutes !== undefined) {
      data['session.inactivityTimeoutMinutes'] = String(dto.sessionInactivityTimeoutMinutes);
    }
    if (Object.keys(data).length === 0) {
      return this.settingsService.getAllAdminView();
    }

    return this.settingsService.updateWithAudit(data, user.id, this.auditService);
  }
}
