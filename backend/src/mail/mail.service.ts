import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';
import { scrubPhi } from '../common/utils/phi-scrub';
import { SettingsService } from '../settings/settings.service';
import {
  escapeHtml,
  formatFromAddress,
  buildLogoUrl,
  renderTemplate,
  type InvitationEmailPayload,
  type InvitationEmailResult,
  type MailSettingsOverrides,
} from './mail-helpers';
import { buildDefaultInvitationHtml, buildPasswordResetEmail } from './mail-auth-templates';
import { resolveMailSettings as resolveConfiguredMailSettings } from './mail-settings-resolver';
import {
  buildBreachNotificationEmail,
  buildDataRequestAcknowledgementEmail,
  buildDataRequestExportLinkEmail,
  buildDataRequestExtendedEmail,
  buildDataRequestRejectedEmail,
  buildDataRequestResolvedEmail,
  buildPatientPortalInviteEmail,
  buildPatientPortalPasswordResetEmail,
} from './mail-notification-templates';
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}
  private async resolveMailSettings(overrides: MailSettingsOverrides = {}) {
    return resolveConfiguredMailSettings(this.settingsService, this.configService, overrides);
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
      : buildDefaultInvitationHtml({
          clinicName: settings.clinicName,
          inviteUrl,
          roleLabel,
          expirationLabel,
          assignedMedicoSection,
          logoUrl,
        });
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
    const logoUrl = buildLogoUrl(settings.appPublicUrl);
    const rendered = buildPasswordResetEmail({
      clinicName: settings.clinicName,
      resetUrl,
      expiresAt: payload.expiresAt,
      recipientName: payload.recipientName,
      logoUrl,
    });
    try {
      await transporter.sendMail({
        from: formatFromAddress(settings.fromEmail, settings.fromName),
        to: payload.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
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
  async sendDataRequestAcknowledgement(payload: { to: string; requesterName: string; requestId: string; requestType: string; dueDate: Date }) {
    const { subject, text, html } = buildDataRequestAcknowledgementEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
  async sendDataRequestResolved(payload: { to: string; requesterName: string; requestId: string; requestType: string; resolutionNote: string }) {
    const { subject, text, html } = buildDataRequestResolvedEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
  async sendDataRequestRejected(payload: { to: string; requesterName: string; requestId: string; requestType: string; reason: string }) {
    const { subject, text, html } = buildDataRequestRejectedEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
  async sendDataRequestExtended(payload: { to: string; requesterName: string; requestId: string; requestType: string; newDueDate: Date; reason: string }) {
    const { subject, text, html } = buildDataRequestExtendedEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
  async sendDataRequestExportLink(payload: { to: string; requesterName: string; requestId: string; downloadUrl: string; expiresAt: Date; maxDownloads: number }) {
    const { subject, text, html } = buildDataRequestExportLinkEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
  async sendPatientPortalInvite(payload: { to: string; patientName: string; activationUrl: string; expiresAt: Date }) {
    const { subject, text, html } = buildPatientPortalInviteEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
  async sendPatientPortalPasswordReset(payload: { to: string; resetUrl: string; expiresAt: Date }) {
    const { subject, text, html } = buildPatientPortalPasswordResetEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
  async sendBreachNotificationToSubject(payload: {
    to: string;
    subjectName: string;
    breachId: string;
    detectedAt: Date;
    scope: string;
    measuresTaken: string;
    responsableName?: string;
    dpoName?: string;
    dpoEmail?: string;
    dataCategoriesAffected?: string;
    possibleConsequences?: string;
    recommendedActions?: string;
    consultationChannels?: string;
    followUpInfo?: string;
  }) {
    const { subject, text, html } = buildBreachNotificationEmail(payload);
    return this.sendPlainEmail({ to: payload.to, subject, text, html });
  }
}
