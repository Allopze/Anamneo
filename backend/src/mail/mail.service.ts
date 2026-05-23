import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';
import { scrubPhi } from '../common/utils/phi-scrub';
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
      const reason = scrubPhi(error instanceof Error ? error.message : 'No se pudo enviar el correo') ?? 'No se pudo enviar el correo';
      const recipient = scrubPhi(payload.email) ?? '[EMAIL]';
      this.logger.error(`No se pudo enviar la invitacion a ${recipient}: ${reason}`);

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

  async sendPasswordResetEmail(payload: {
    email: string;
    token: string;
    expiresAt: Date;
    recipientName?: string | null;
  }): Promise<{ sent: boolean; reason: string | null; resetUrl: string | null }> {
    const settings = await this.resolveMailSettings();
    const resetUrl = settings.appPublicUrl
      ? `${settings.appPublicUrl}/cambiar-contrasena?token=${encodeURIComponent(payload.token)}`
      : null;

    if (!settings.canSend || !resetUrl || !settings.host || !settings.port || !settings.fromEmail) {
      return {
        sent: false,
        reason: settings.misconfiguration ?? 'SMTP no configurado',
        resetUrl,
      };
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.user ? { user: settings.user, pass: settings.password ?? '' } : undefined,
    });

    const expirationLabel = payload.expiresAt.toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const greetingName = payload.recipientName ? `Hola ${payload.recipientName},` : 'Hola,';
    const subject = `Recuperación de contraseña en ${settings.clinicName}`;

    const textBody = [
      greetingName,
      '',
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${settings.clinicName}.`,
      '',
      `Para continuar, abre este enlace antes del ${expirationLabel}:`,
      resetUrl,
      '',
      'Si no fuiste tú, ignora este correo. Tu contraseña actual sigue siendo válida.',
      '',
      'Por seguridad, este enlace solo se puede usar una vez y caduca rápido.',
    ].join('\n');

    const logoUrl = buildLogoUrl(settings.appPublicUrl);
    const logoMarkup = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(settings.clinicName)}" style="display:block; width:168px; max-width:100%; margin:0 auto 18px;" />`
      : `<div style="display:inline-block; padding:10px 18px; border-radius:999px; background:#fee2e2; color:#991b1b; font-weight:700;">${escapeHtml(settings.clinicName)}</div>`;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:32px;">
          <div style="text-align:center; margin-bottom:24px;">
            ${logoMarkup}
            <p style="margin:0; color:#991b1b; font-size:13px; text-transform:uppercase; letter-spacing:0.16em;">Recuperación de contraseña</p>
          </div>
          <p style="margin:0 0 12px; color:#475569;">${escapeHtml(greetingName)}</p>
          <p style="margin:0 0 16px; color:#475569;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${escapeHtml(settings.clinicName)}</strong>.</p>
          <p style="margin:0 0 20px; color:#475569;">Para continuar, abre este enlace antes del <strong>${escapeHtml(expirationLabel)}</strong>:</p>
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#dc2626; color:#ffffff; text-decoration:none; font-weight:600;">Restablecer contraseña</a>
          <p style="margin:20px 0 0; color:#64748b; font-size:14px;">Si el botón no funciona, copia este enlace:</p>
          <p style="margin:8px 0 0; color:#0f172a; font-size:14px; word-break:break-all;">${escapeHtml(resetUrl)}</p>
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />
          <p style="margin:0; color:#64748b; font-size:13px;">Si no fuiste tú, ignora este correo. El enlace caduca pronto y solo puede usarse una vez.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: formatFromAddress(settings.fromEmail, settings.fromName),
        to: payload.email,
        subject,
        text: textBody,
        html: htmlBody,
      });

      return { sent: true, reason: null, resetUrl };
    } catch (error) {
      const reason = scrubPhi(error instanceof Error ? error.message : 'No se pudo enviar el correo') ?? 'No se pudo enviar el correo';
      const recipient = scrubPhi(payload.email) ?? '[EMAIL]';
      this.logger.error(`No se pudo enviar el reset de contraseña a ${recipient}: ${reason}`);
      return { sent: false, reason, resetUrl };
    }
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

  // -----------------------------------------------------------------------
  // Ley 21.719 — comunicaciones a titulares (solicitudes de derechos y
  // notificaciones de brechas). Reutilizan SMTP del MailService existente.
  // -----------------------------------------------------------------------

  private async sendPlainEmail(payload: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ sent: boolean; reason: string | null }> {
    const settings = await this.resolveMailSettings();
    if (!settings.canSend || !settings.host || !settings.port || !settings.fromEmail) {
      return { sent: false, reason: settings.misconfiguration ?? 'SMTP no configurado' };
    }
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.user ? { user: settings.user, pass: settings.password ?? '' } : undefined,
    });
    try {
      await transporter.sendMail({
        from: formatFromAddress(settings.fromEmail, settings.fromName),
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      return { sent: true, reason: null };
    } catch (error) {
      const reason = scrubPhi(error instanceof Error ? error.message : 'No se pudo enviar el correo') ?? 'No se pudo enviar el correo';
      const recipient = scrubPhi(payload.to) ?? '[EMAIL]';
      this.logger.error(`No se pudo enviar correo a ${recipient}: ${reason}`);
      return { sent: false, reason };
    }
  }

  private formatDateCL(date: Date): string {
    return date.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  }

  async sendDataRequestAcknowledgement(payload: {
    to: string;
    requesterName: string;
    requestId: string;
    requestType: string;
    dueDate: Date;
  }) {
    const subject = `Acuse de recibo — solicitud de derechos (Ley 21.719) #${payload.requestId.slice(0, 8)}`;
    const text = [
      `Hola ${payload.requesterName},`,
      '',
      `Recibimos tu solicitud de tipo ${payload.requestType} bajo la Ley 21.719.`,
      `Número de seguimiento interno: ${payload.requestId}`,
      `Plazo legal de respuesta: ${this.formatDateCL(payload.dueDate)} (30 días corridos, Art 11).`,
      '',
      'Verificaremos tu identidad y responderemos dentro del plazo. Si necesitamos extender la respuesta por hasta 30 días adicionales, te avisaremos por este mismo medio.',
      '',
      'Si no realizaste esta solicitud, escríbenos de inmediato.',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2>Acuse de recibo</h2>
      <p>Hola ${escapeHtml(payload.requesterName)},</p>
      <p>Recibimos tu solicitud de tipo <strong>${escapeHtml(payload.requestType)}</strong> bajo la Ley 21.719.</p>
      <p>Número de seguimiento interno: <code>${escapeHtml(payload.requestId)}</code></p>
      <p>Plazo legal de respuesta: <strong>${escapeHtml(this.formatDateCL(payload.dueDate))}</strong> (30 días corridos, Art 11).</p>
      <p>Verificaremos tu identidad y responderemos dentro del plazo.</p>
      <p style="color:#64748b;font-size:13px;">Si no realizaste esta solicitud, escríbenos de inmediato.</p>
    </div>`;
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }

  async sendDataRequestResolved(payload: {
    to: string;
    requesterName: string;
    requestId: string;
    requestType: string;
    resolutionNote: string;
  }) {
    const subject = `Resolución de tu solicitud (Ley 21.719) #${payload.requestId.slice(0, 8)}`;
    const text = [
      `Hola ${payload.requesterName},`,
      '',
      `Hemos resuelto favorablemente tu solicitud de tipo ${payload.requestType}.`,
      '',
      'Detalle de la resolución:',
      payload.resolutionNote,
      '',
      'Si necesitas aclaraciones, responde a este correo.',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2>Resolución aceptada</h2>
      <p>Hola ${escapeHtml(payload.requesterName)},</p>
      <p>Hemos resuelto favorablemente tu solicitud de tipo <strong>${escapeHtml(payload.requestType)}</strong>.</p>
      <p><strong>Detalle:</strong></p>
      <p style="white-space:pre-line;">${escapeHtml(payload.resolutionNote)}</p>
    </div>`;
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }

  async sendDataRequestRejected(payload: {
    to: string;
    requesterName: string;
    requestId: string;
    requestType: string;
    reason: string;
  }) {
    const subject = `Resolución de tu solicitud (Ley 21.719) #${payload.requestId.slice(0, 8)}`;
    const text = [
      `Hola ${payload.requesterName},`,
      '',
      `Tras revisión, no podemos acoger tu solicitud de tipo ${payload.requestType}.`,
      '',
      'Motivo fundado:',
      payload.reason,
      '',
      'Puedes reclamar esta decisión ante la Agencia de Protección de Datos Personales (Art 11 inciso final, Art 41 Ley 21.719).',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2>Resolución no acogida</h2>
      <p>Hola ${escapeHtml(payload.requesterName)},</p>
      <p>Tras revisión, no podemos acoger tu solicitud de tipo <strong>${escapeHtml(payload.requestType)}</strong>.</p>
      <p><strong>Motivo fundado:</strong></p>
      <p style="white-space:pre-line;">${escapeHtml(payload.reason)}</p>
      <p style="color:#64748b;font-size:13px;">Puedes reclamar esta decisión ante la Agencia de Protección de Datos Personales (Art 41 Ley 21.719).</p>
    </div>`;
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }

  async sendDataRequestExtended(payload: {
    to: string;
    requesterName: string;
    requestId: string;
    requestType: string;
    newDueDate: Date;
    reason: string;
  }) {
    const subject = `Prórroga de plazo en tu solicitud (Ley 21.719) #${payload.requestId.slice(0, 8)}`;
    const text = [
      `Hola ${payload.requesterName},`,
      '',
      `Extendemos por 30 días corridos adicionales (Art 11) el plazo para responder a tu solicitud de tipo ${payload.requestType}.`,
      `Nuevo plazo máximo de respuesta: ${this.formatDateCL(payload.newDueDate)}.`,
      '',
      'Motivo de la prórroga:',
      payload.reason,
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2>Prórroga aplicada</h2>
      <p>Hola ${escapeHtml(payload.requesterName)},</p>
      <p>Extendemos por 30 días corridos adicionales (Art 11) el plazo para responder a tu solicitud de tipo <strong>${escapeHtml(payload.requestType)}</strong>.</p>
      <p>Nuevo plazo máximo: <strong>${escapeHtml(this.formatDateCL(payload.newDueDate))}</strong>.</p>
      <p style="white-space:pre-line;">${escapeHtml(payload.reason)}</p>
    </div>`;
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }

  async sendDataRequestExportLink(payload: {
    to: string;
    requesterName: string;
    requestId: string;
    downloadUrl: string;
    expiresAt: Date;
    maxDownloads: number;
  }) {
    const subject = `Descarga segura de ficha clínica #${payload.requestId.slice(0, 8)}`;
    const text = [
      `Hola ${payload.requesterName},`,
      '',
      'Tu copia de ficha clínica está disponible mediante un enlace temporal.',
      `Enlace: ${payload.downloadUrl}`,
      `Vence: ${this.formatDateCL(payload.expiresAt)}.`,
      `Máximo de descargas: ${payload.maxDownloads}.`,
      '',
      'Por seguridad, la descarga solicitará el RUT asociado a la solicitud.',
      'Si no solicitaste esta copia, responde a este correo de inmediato.',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2>Descarga segura de ficha clínica</h2>
      <p>Hola ${escapeHtml(payload.requesterName)},</p>
      <p>Tu copia de ficha clínica está disponible mediante un enlace temporal.</p>
      <p>
        <a href="${escapeHtml(payload.downloadUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:600;">Descargar ficha clínica</a>
      </p>
      <p>Vence: <strong>${escapeHtml(this.formatDateCL(payload.expiresAt))}</strong>.</p>
      <p>Máximo de descargas: <strong>${payload.maxDownloads}</strong>.</p>
      <p style="margin:8px 0 0; color:#0f172a; font-size:14px; word-break:break-all;">${escapeHtml(payload.downloadUrl)}</p>
      <p style="color:#64748b;font-size:13px;">Por seguridad, la descarga solicitará el RUT asociado a la solicitud. Si no solicitaste esta copia, responde a este correo de inmediato.</p>
    </div>`;
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }

  async sendPatientPortalInvite(payload: {
    to: string;
    patientName: string;
    activationUrl: string;
    expiresAt: Date;
  }) {
    const subject = 'Invitación al portal paciente Anamneo';
    const text = [
      'Hola,',
      '',
      `Se creó una invitación para acceder al portal paciente de ${payload.patientName}.`,
      `Activa la cuenta aquí: ${payload.activationUrl}`,
      `El enlace vence: ${this.formatDateCL(payload.expiresAt)}.`,
      '',
      'Si no esperabas esta invitación, ignora este correo y avisa a la clínica.',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2>Invitación al portal paciente</h2>
      <p>Se creó una invitación para acceder al portal paciente de <strong>${escapeHtml(payload.patientName)}</strong>.</p>
      <p>
        <a href="${escapeHtml(payload.activationUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:600;">Activar cuenta</a>
      </p>
      <p>El enlace vence: <strong>${escapeHtml(this.formatDateCL(payload.expiresAt))}</strong>.</p>
      <p style="word-break:break-all;">${escapeHtml(payload.activationUrl)}</p>
      <p style="color:#64748b;font-size:13px;">Si no esperabas esta invitación, ignora este correo y avisa a la clínica.</p>
    </div>`;
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }

  async sendPatientPortalPasswordReset(payload: {
    to: string;
    resetUrl: string;
    expiresAt: Date;
  }) {
    const subject = 'Restablecer contraseña del portal paciente';
    const text = [
      'Hola,',
      '',
      'Recibimos una solicitud para restablecer tu contraseña del portal paciente.',
      `Enlace: ${payload.resetUrl}`,
      `Vence: ${this.formatDateCL(payload.expiresAt)}.`,
      '',
      'Si no solicitaste este cambio, ignora este correo.',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2>Restablecer contraseña</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña del portal paciente.</p>
      <p>
        <a href="${escapeHtml(payload.resetUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:600;">Restablecer contraseña</a>
      </p>
      <p>Vence: <strong>${escapeHtml(this.formatDateCL(payload.expiresAt))}</strong>.</p>
      <p style="word-break:break-all;">${escapeHtml(payload.resetUrl)}</p>
    </div>`;
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }

  /**
   * Ley 21.719 Art 14 sexies. Notificacion a titulares afectados.
   * Cubre los 11 elementos minimos recomendados por asesor legal en
   * docs/respuestas-borrador-ley21719.md §3.3.
   */
  async sendBreachNotificationToSubject(payload: {
    to: string;
    subjectName: string;
    breachId: string;
    detectedAt: Date;
    scope: string;
    measuresTaken: string;
    // Campos nuevos (5 elementos faltantes):
    // - responsableName: identificacion del responsable del tratamiento (clinica usuaria)
    // - dpoName + dpoEmail: contacto del DPO
    // - dataCategoriesAffected: categorias de datos comprometidas
    // - possibleConsequences: posibles consecuencias para el titular
    // - recommendedActions: medidas recomendadas al titular
    // - consultationChannels: canales disponibles para consulta
    // - followUpInfo: cuando y como se actualizara al titular
    responsableName?: string;
    dpoName?: string;
    dpoEmail?: string;
    dataCategoriesAffected?: string;
    possibleConsequences?: string;
    recommendedActions?: string;
    consultationChannels?: string;
    followUpInfo?: string;
  }) {
    const subject = `Notificación obligatoria — incidente de seguridad (Ley 21.719 Art 14 sexies) #${payload.breachId.slice(0, 8)}`;
    const responsableLine = payload.responsableName
      ? `Responsable del tratamiento: ${payload.responsableName}.`
      : 'Responsable del tratamiento: [responsable que opera la instancia Anamneo].';
    const dpoLine = payload.dpoEmail
      ? `Contacto del Delegado de Protección de Datos (DPO)${payload.dpoName ? ` — ${payload.dpoName}` : ''}: ${payload.dpoEmail}.`
      : 'Contacto del Delegado de Protección de Datos (DPO): consulte la política de privacidad publicada por su clínica.';
    const dataCategoriesLine = payload.dataCategoriesAffected
      ? `Categorías de datos afectadas: ${payload.dataCategoriesAffected}.`
      : 'Categorías de datos afectadas: datos personales sensibles relacionados con su atención clínica.';
    const consequencesLine = payload.possibleConsequences
      ? `Posibles consecuencias: ${payload.possibleConsequences}.`
      : 'Posibles consecuencias: riesgo de acceso indebido a información de salud; no se han identificado consecuencias adicionales hasta la fecha de esta notificación.';
    const recommendedLine = payload.recommendedActions
      ? `Medidas recomendadas: ${payload.recommendedActions}.`
      : 'Medidas recomendadas: si nota uso indebido de su información, contáctenos de inmediato. Cambie credenciales asociadas y revise comunicaciones recibidas.';
    const consultationLine = payload.consultationChannels
      ? `Canales de consulta: ${payload.consultationChannels}.`
      : 'Canales de consulta: escriba al correo del DPO o al canal de contacto formal de su clínica.';
    const followUpLine = payload.followUpInfo
      ? `Seguimiento: ${payload.followUpInfo}.`
      : 'Seguimiento: le mantendremos informado(a) si se identifican impactos adicionales o medidas correctivas relevantes.';

    const text = [
      `Estimado(a) ${payload.subjectName},`,
      '',
      responsableLine,
      dpoLine,
      '',
      `Le informamos que hemos detectado un incidente que afecta a la seguridad de sus datos personales registrados en Anamneo.`,
      `Fecha o período estimado del incidente: ${this.formatDateCL(payload.detectedAt)}.`,
      '',
      'Descripción del incidente:',
      payload.scope,
      '',
      dataCategoriesLine,
      '',
      consequencesLine,
      '',
      'Medidas adoptadas por el responsable:',
      payload.measuresTaken,
      '',
      recommendedLine,
      '',
      consultationLine,
      '',
      'Esta notificación se realiza en cumplimiento del Art 14 sexies de la Ley 21.719. Usted tiene derecho a reclamar ante la Agencia de Protección de Datos Personales si considera que sus derechos no fueron respetados (Art 41 Ley 21.719).',
      '',
      followUpLine,
    ].join('\n');

    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.55;">
      <h2 style="color:#b91c1c;">Notificación obligatoria — incidente de seguridad</h2>
      <p>Estimado(a) ${escapeHtml(payload.subjectName)},</p>
      <p style="font-size:13px;color:#475569;">${escapeHtml(responsableLine)}<br/>${escapeHtml(dpoLine)}</p>
      <p>Le informamos que hemos detectado un incidente que afecta a la seguridad de sus datos personales registrados en Anamneo.</p>
      <p><strong>Fecha o período estimado:</strong> ${escapeHtml(this.formatDateCL(payload.detectedAt))}</p>
      <p><strong>Descripción del incidente:</strong></p>
      <p style="white-space:pre-line;">${escapeHtml(payload.scope)}</p>
      <p><strong>Categorías de datos afectadas:</strong> ${escapeHtml(payload.dataCategoriesAffected ?? 'datos personales sensibles relacionados con su atención clínica')}</p>
      <p><strong>Posibles consecuencias:</strong> ${escapeHtml(payload.possibleConsequences ?? 'riesgo de acceso indebido a información de salud; no se han identificado consecuencias adicionales hasta la fecha de esta notificación')}</p>
      <p><strong>Medidas adoptadas por el responsable:</strong></p>
      <p style="white-space:pre-line;">${escapeHtml(payload.measuresTaken)}</p>
      <p><strong>Medidas recomendadas:</strong> ${escapeHtml(payload.recommendedActions ?? 'si nota uso indebido de su información, contáctenos de inmediato. Cambie credenciales asociadas y revise comunicaciones recibidas')}</p>
      <p><strong>Canales de consulta:</strong> ${escapeHtml(payload.consultationChannels ?? 'escriba al correo del DPO o al canal de contacto formal de su clínica')}</p>
      <p style="color:#475569;font-size:13px;">Esta notificación se realiza en cumplimiento del Art 14 sexies de la Ley 21.719. Usted tiene derecho a reclamar ante la <strong>Agencia de Protección de Datos Personales</strong> si considera que sus derechos no fueron respetados (Art 41 Ley 21.719).</p>
      <p style="color:#475569;font-size:13px;">${escapeHtml(followUpLine)}</p>
    </div>`;

    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
}
