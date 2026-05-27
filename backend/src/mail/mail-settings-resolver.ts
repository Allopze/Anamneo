import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_INVITATION_SUBJECT,
  normalizePublicUrl,
  parseBoolean,
  parsePort,
  pickValue,
  type MailSettingsOverrides,
  type ResolvedMailSettings,
} from './mail-helpers';

export async function resolveMailSettings(
  settingsService: SettingsService,
  configService: ConfigService,
  overrides: MailSettingsOverrides = {},
): Promise<ResolvedMailSettings> {
  const settings = await settingsService.getAll();
  const clinicName = pickValue(overrides.clinicName, settings['clinic.name'], 'Anamneo') ?? 'Anamneo';
  const appPublicUrl = normalizePublicUrl(pickValue(
    overrides.appPublicUrl,
    settings['app.publicUrl'],
    configService.get<string>('APP_PUBLIC_URL'),
    configService.get<string>('FRONTEND_PUBLIC_URL'),
  ));
  const host = pickValue(
    overrides.smtpHost,
    settings['smtp.host'],
    configService.get<string>('SMTP_HOST'),
  );
  const port = parsePort(pickValue(
    overrides.smtpPort,
    settings['smtp.port'],
    configService.get<string>('SMTP_PORT'),
  ));
  const secure = parseBoolean(
    overrides.smtpSecure ?? pickValue(
      settings['smtp.secure'],
      configService.get<string>('SMTP_SECURE'),
    ),
    port === 465,
  );
  const user = pickValue(
    overrides.smtpUser,
    settings['smtp.user'],
    configService.get<string>('SMTP_USER'),
  );
  const password = pickValue(
    overrides.smtpPassword,
    settings['smtp.password'],
    configService.get<string>('SMTP_PASSWORD'),
  );
  const fromEmail = pickValue(
    overrides.smtpFromEmail,
    settings['smtp.fromEmail'],
    configService.get<string>('SMTP_FROM_EMAIL'),
    settings['clinic.email'],
    user,
  );
  const fromName = pickValue(
    overrides.smtpFromName,
    settings['smtp.fromName'],
    configService.get<string>('SMTP_FROM_NAME'),
    clinicName,
  );
  const templateHtml = pickValue(
    overrides.invitationTemplateHtml,
    settings['email.invitationTemplateHtml'],
  );
  const subjectTemplate = pickValue(
    overrides.invitationSubject,
    settings['email.invitationSubject'],
    configService.get<string>('INVITATION_EMAIL_SUBJECT'),
    DEFAULT_INVITATION_SUBJECT,
  ) ?? DEFAULT_INVITATION_SUBJECT;

  const missingFields: string[] = [];
  if (!appPublicUrl) {
    missingFields.push('URL publica de la aplicacion');
  }
  if (!host) {
    missingFields.push('host SMTP');
  }
  if (!port) {
    missingFields.push('puerto SMTP');
  }
  if (!fromEmail) {
    missingFields.push('correo remitente');
  }
  if ((user && !password) || (!user && password)) {
    missingFields.push('usuario y clave SMTP completos');
  }

  return {
    clinicName,
    appPublicUrl,
    host,
    port,
    secure,
    user,
    password,
    fromEmail,
    fromName,
    templateHtml,
    subjectTemplate,
    canSend: missingFields.length === 0,
    misconfiguration: missingFields.length > 0
      ? `Configuracion SMTP incompleta: ${missingFields.join(', ')}`
      : null,
  };
}
