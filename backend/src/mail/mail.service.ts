import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_INVITATION_SUBJECT,
  pickValue,
  parsePort,
  parseBoolean,
  normalizePublicUrl,
  escapeHtml,
  formatFromAddress,
  buildLogoUrl,
  renderTemplate,
  type InvitationEmailPayload,
  type InvitationEmailResult,
  type MailSettingsOverrides,
  type ResolvedMailSettings,
} from './mail-helpers';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  private buildDefaultInvitationHtml(
    clinicName: string,
    inviteUrl: string,
    roleLabel: string,
    expirationLabel: string,
    assignedMedicoSection: string,
    logoUrl: string | null,
  ) {
    const logoMarkup = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(clinicName)}" style="display:block; width:168px; max-width:100%; margin:0 auto 18px;" />`
      : `<div style="display:inline-block; padding:10px 18px; border-radius:999px; background:#ccfbf1; color:#115e59; font-weight:700;">${escapeHtml(clinicName)}</div>`;

    return `
      <div style="font-family:Arial,sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:32px;">
          <div style="text-align:center; margin-bottom:24px;">
            ${logoMarkup}
            <p style="margin:0; color:#0f766e; font-size:13px; text-transform:uppercase; letter-spacing:0.16em;">Bienvenida</p>
          </div>
          <p style="margin:0 0 12px; color:#475569;">Hola,</p>
          <h1 style="margin:0 0 16px; font-size:24px; line-height:1.3;">Invitacion a ${escapeHtml(clinicName)}</h1>
          <p style="margin:0 0 12px; color:#475569;">Has sido invitado a la plataforma con perfil de <strong>${escapeHtml(roleLabel)}</strong>.</p>
          ${assignedMedicoSection}
          <p style="margin:0 0 20px; color:#475569;">La invitacion vence el <strong>${escapeHtml(expirationLabel)}</strong>.</p>
          <a href="${escapeHtml(inviteUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:600;">Completar registro</a>
          <p style="margin:20px 0 0; color:#64748b; font-size:14px;">Si el boton no funciona, copia este enlace:</p>
          <p style="margin:8px 0 0; color:#0f172a; font-size:14px; word-break:break-all;">${escapeHtml(inviteUrl)}</p>
        </div>
      </div>
    `;
  }

  private async resolveMailSettings(overrides: MailSettingsOverrides = {}): Promise<ResolvedMailSettings> {
    const settings = await this.settingsService.getAll();
    const clinicName = pickValue(overrides.clinicName, settings['clinic.name'], 'Anamneo') ?? 'Anamneo';
    const appPublicUrl = normalizePublicUrl(pickValue(
      overrides.appPublicUrl,
      settings['app.publicUrl'],
      this.configService.get<string>('APP_PUBLIC_URL'),
      this.configService.get<string>('FRONTEND_PUBLIC_URL'),
    ));
    const host = pickValue(
      overrides.smtpHost,
      settings['smtp.host'],
      this.configService.get<string>('SMTP_HOST'),
    );
    const port = parsePort(pickValue(
      overrides.smtpPort,
      settings['smtp.port'],
      this.configService.get<string>('SMTP_PORT'),
    ));
    const secure = parseBoolean(
      overrides.smtpSecure ?? pickValue(
        settings['smtp.secure'],
        this.configService.get<string>('SMTP_SECURE'),
      ),
      port === 465,
    );
    const user = pickValue(
      overrides.smtpUser,
      settings['smtp.user'],
      this.configService.get<string>('SMTP_USER'),
    );
    const password = pickValue(
      overrides.smtpPassword,
      settings['smtp.password'],
      this.configService.get<string>('SMTP_PASSWORD'),
    );
    const fromEmail = pickValue(
      overrides.smtpFromEmail,
      settings['smtp.fromEmail'],
      this.configService.get<string>('SMTP_FROM_EMAIL'),
      settings['clinic.email'],
      user,
    );
    const fromName = pickValue(
      overrides.smtpFromName,
      settings['smtp.fromName'],
      this.configService.get<string>('SMTP_FROM_NAME'),
      clinicName,
    );
    const templateHtml = pickValue(
      overrides.invitationTemplateHtml,
      settings['email.invitationTemplateHtml'],
    );
    const subjectTemplate = pickValue(
      overrides.invitationSubject,
      settings['email.invitationSubject'],
      this.configService.get<string>('INVITATION_EMAIL_SUBJECT'),
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

  private async deliverInvitationEmail(
    payload: InvitationEmailPayload,
    overrides: MailSettingsOverrides = {},
    options?: { isTest?: boolean },
  ): Promise<InvitationEmailResult> {
    const settings = await this.resolveMailSettings(overrides);
    const inviteUrl = settings.appPublicUrl
      ? `${settings.appPublicUrl}/register?token=${encodeURIComponent(payload.token)}`
      : null;

    if (!settings.canSend || !inviteUrl || !settings.host || !settings.port || !settings.fromEmail) {
      return {
        sent: false,
        reason: settings.misconfiguration ?? 'SMTP no configurado',
        inviteUrl,
        subject: null,
      };
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.user
        ? {
            user: settings.user,
            pass: settings.password ?? '',
          }
        : undefined,
    });

    const roleLabel = payload.role === 'MEDICO' ? 'medico' : payload.role === 'ADMIN' ? 'administrador' : 'asistente';
    const assignedMedicoLine = payload.assignedMedicoName
      ? `Medico asignado: ${payload.assignedMedicoName}`
      : null;
    const assignedMedicoSection = payload.assignedMedicoName
      ? `<p style="margin:0 0 12px; color:#475569;">Medico asignado: <strong>${escapeHtml(payload.assignedMedicoName)}</strong></p>`
      : '';
    const expirationLabel = payload.expiresAt.toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const logoUrl = buildLogoUrl(settings.appPublicUrl);
    const subject = renderTemplate(
      options?.isTest ? `Prueba: ${settings.subjectTemplate}` : settings.subjectTemplate,
      {
        clinicName: settings.clinicName,
        recipientEmail: payload.email,
        inviteUrl: inviteUrl,
        roleLabel,
        expirationLabel,
        assignedMedicoName: payload.assignedMedicoName ?? '',
        assignedMedicoSection: payload.assignedMedicoName ?? '',
        logoUrl: logoUrl ?? '',
        year: String(new Date().getFullYear()),
      },
    );

    const textBody = [
      'Hola,',
      '',
      `Has sido invitado a ${settings.clinicName} con perfil de ${roleLabel}.`,
      assignedMedicoLine,
      `Completa tu registro aqui: ${inviteUrl}`,
      `La invitacion vence el ${expirationLabel}.`,
      '',
      'Si no esperabas este correo, puedes ignorarlo.',
    ]
      .filter(Boolean)
      .join('\n');

    const htmlBody = settings.templateHtml
      ? renderTemplate(settings.templateHtml, {
          clinicName: escapeHtml(settings.clinicName),
          recipientEmail: escapeHtml(payload.email),
          inviteUrl: escapeHtml(inviteUrl),
          roleLabel: escapeHtml(roleLabel),
          expirationLabel: escapeHtml(expirationLabel),
          assignedMedicoName: escapeHtml(payload.assignedMedicoName ?? ''),
          assignedMedicoSection,
          logoUrl: escapeHtml(logoUrl ?? ''),
          year: String(new Date().getFullYear()),
        })
      : this.buildDefaultInvitationHtml(
          settings.clinicName,
          inviteUrl,
          roleLabel,
          expirationLabel,
          assignedMedicoSection,
          logoUrl,
        );

    try {
      await transporter.sendMail({
        from: formatFromAddress(settings.fromEmail, settings.fromName),
        to: payload.email,
        subject,
        text: textBody,
        html: htmlBody,
      });

      return {
        sent: true,
        reason: null,
        inviteUrl,
        subject,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No se pudo enviar el correo';
      this.logger.error(`No se pudo enviar la invitacion a ${payload.email}: ${reason}`);

      return {
        sent: false,
        reason,
        inviteUrl,
        subject,
      };
    }
  }

  async sendInvitationEmail(payload: InvitationEmailPayload): Promise<InvitationEmailResult> {
    return this.deliverInvitationEmail(payload);
  }

  async sendTestInvitationEmail(
    email: string,
    overrides: MailSettingsOverrides = {},
  ): Promise<InvitationEmailResult> {
    return this.deliverInvitationEmail(
      {
        email,
        role: 'MEDICO',
        token: `preview-${randomBytes(12).toString('hex')}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assignedMedicoName: 'Dra. Elena Rojas',
      },
      overrides,
      { isTest: true },
    );
  }
}