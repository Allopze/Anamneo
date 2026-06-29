import { escapeHtml } from './mail-helpers';
import { MAIL_COLORS } from './mail-theme';

export function buildDefaultInvitationHtml(params: {
  clinicName: string;
  inviteUrl: string;
  roleLabel: string;
  expirationLabel: string;
  assignedMedicoSection: string;
  logoUrl: string | null;
}) {
  const logoMarkup = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="${escapeHtml(params.clinicName)}" style="display:block; width:168px; max-width:100%; margin:0 auto 18px;" />`
    : `<div style="display:inline-block; padding:10px 18px; border-radius:999px; background:${MAIL_COLORS.teal.light}; color:${MAIL_COLORS.teal.dark}; font-weight:700;">${escapeHtml(params.clinicName)}</div>`;

  return `
    <div style="font-family:Arial,sans-serif; background:${MAIL_COLORS.neutral.bg}; padding:24px; color:${MAIL_COLORS.neutral.ink};">
      <div style="max-width:560px; margin:0 auto; background:${MAIL_COLORS.neutral.card}; border:1px solid ${MAIL_COLORS.neutral.border}; border-radius:16px; padding:32px;">
        <div style="text-align:center; margin-bottom:24px;">
          ${logoMarkup}
          <p style="margin:0; color:${MAIL_COLORS.teal.kicker}; font-size:13px; text-transform:uppercase; letter-spacing:0.16em;">Bienvenida</p>
        </div>
        <p style="margin:0 0 12px; color:${MAIL_COLORS.neutral.body};">Hola,</p>
        <h1 style="margin:0 0 16px; font-size:24px; line-height:1.3;">Invitacion a ${escapeHtml(params.clinicName)}</h1>
        <p style="margin:0 0 12px; color:${MAIL_COLORS.neutral.body};">Has sido invitado a la plataforma con perfil de <strong>${escapeHtml(params.roleLabel)}</strong>.</p>
        ${params.assignedMedicoSection}
        <p style="margin:0 0 20px; color:${MAIL_COLORS.neutral.body};">La invitacion vence el <strong>${escapeHtml(params.expirationLabel)}</strong>.</p>
        <a href="${escapeHtml(params.inviteUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:${MAIL_COLORS.teal.cta}; color:${MAIL_COLORS.teal.onCta}; text-decoration:none; font-weight:600;">Completar registro</a>
        <p style="margin:20px 0 0; color:${MAIL_COLORS.neutral.muted}; font-size:14px;">Si el boton no funciona, copia este enlace:</p>
        <p style="margin:8px 0 0; color:${MAIL_COLORS.neutral.ink}; font-size:14px; word-break:break-all;">${escapeHtml(params.inviteUrl)}</p>
      </div>
    </div>
  `;
}

export function buildPasswordResetEmail(params: {
  clinicName: string;
  resetUrl: string;
  expiresAt: Date;
  recipientName?: string | null;
  logoUrl: string | null;
}) {
  const expirationLabel = params.expiresAt.toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const greetingName = params.recipientName ? `Hola ${params.recipientName},` : 'Hola,';
  const subject = `Recuperación de contraseña en ${params.clinicName}`;
  const text = [
    greetingName,
    '',
    `Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${params.clinicName}.`,
    '',
    `Para continuar, abre este enlace antes del ${expirationLabel}:`,
    params.resetUrl,
    '',
    'Si no fuiste tú, ignora este correo. Tu contraseña actual sigue siendo válida.',
    '',
    'Por seguridad, este enlace solo se puede usar una vez y caduca rápido.',
  ].join('\n');
  const logoMarkup = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="${escapeHtml(params.clinicName)}" style="display:block; width:168px; max-width:100%; margin:0 auto 18px;" />`
    : `<div style="display:inline-block; padding:10px 18px; border-radius:999px; background:${MAIL_COLORS.error.light}; color:${MAIL_COLORS.error.dark}; font-weight:700;">${escapeHtml(params.clinicName)}</div>`;
  const html = `
    <div style="font-family:Arial,sans-serif; background:${MAIL_COLORS.neutral.bg}; padding:24px; color:${MAIL_COLORS.neutral.ink};">
      <div style="max-width:560px; margin:0 auto; background:${MAIL_COLORS.neutral.card}; border:1px solid ${MAIL_COLORS.neutral.border}; border-radius:16px; padding:32px;">
        <div style="text-align:center; margin-bottom:24px;">
          ${logoMarkup}
          <p style="margin:0; color:${MAIL_COLORS.error.kicker}; font-size:13px; text-transform:uppercase; letter-spacing:0.16em;">Recuperación de contraseña</p>
        </div>
        <p style="margin:0 0 12px; color:${MAIL_COLORS.neutral.body};">${escapeHtml(greetingName)}</p>
        <p style="margin:0 0 16px; color:${MAIL_COLORS.neutral.body};">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${escapeHtml(params.clinicName)}</strong>.</p>
        <p style="margin:0 0 20px; color:${MAIL_COLORS.neutral.body};">Para continuar, abre este enlace antes del <strong>${escapeHtml(expirationLabel)}</strong>:</p>
        <a href="${escapeHtml(params.resetUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:${MAIL_COLORS.error.cta}; color:${MAIL_COLORS.error.onCta}; text-decoration:none; font-weight:600;">Restablecer contraseña</a>
        <p style="margin:20px 0 0; color:${MAIL_COLORS.neutral.muted}; font-size:14px;">Si el botón no funciona, copia este enlace:</p>
        <p style="margin:8px 0 0; color:${MAIL_COLORS.neutral.ink}; font-size:14px; word-break:break-all;">${escapeHtml(params.resetUrl)}</p>
        <hr style="border:none; border-top:1px solid ${MAIL_COLORS.neutral.border}; margin:24px 0;" />
        <p style="margin:0; color:${MAIL_COLORS.neutral.muted}; font-size:13px;">Si no fuiste tú, ignora este correo. El enlace caduca pronto y solo puede usarse una vez.</p>
      </div>
    </div>
  `;
  return { subject, text, html };
}
