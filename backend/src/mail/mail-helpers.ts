export type InvitationRole = 'MEDICO' | 'ASISTENTE' | 'ADMIN';

export type InvitationEmailPayload = {
  email: string;
  role: InvitationRole;
  token: string;
  expiresAt: Date;
  assignedMedicoName?: string | null;
};

export type InvitationEmailResult = {
  sent: boolean;
  reason: string | null;
  inviteUrl: string | null;
  subject: string | null;
};

export type MailSettingsOverrides = {
  clinicName?: string | null;
  appPublicUrl?: string | null;
  smtpHost?: string | null;
  smtpPort?: string | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  invitationTemplateHtml?: string | null;
  invitationSubject?: string | null;
};

export type ResolvedMailSettings = {
  clinicName: string;
  appPublicUrl: string | null;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  password: string | null;
  fromEmail: string | null;
  fromName: string | null;
  templateHtml: string | null;
  subjectTemplate: string;
  canSend: boolean;
  misconfiguration: string | null;
};

export const DEFAULT_INVITATION_SUBJECT = 'Invitacion a {{clinicName}}';

export function pickValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

export function parsePort(value: string | null) {
  if (!value) return null;
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) return null;
  return port;
}

export function parseBoolean(value: string | boolean | null | undefined, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function normalizePublicUrl(value: string | null) {
  if (!value) return null;
  return value.replace(/\/+$/, '');
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatFromAddress(fromEmail: string, fromName: string | null) {
  if (!fromName) return fromEmail;
  return `"${fromName.replace(/"/g, '\\"')}" <${fromEmail}>`;
}

export function buildLogoUrl(appPublicUrl: string | null) {
  if (!appPublicUrl) return null;
  return `${appPublicUrl}/anamneo-logo.svg`;
}

export function renderTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (rendered, [key, value]) => rendered.split(`{{${key}}}`).join(value),
    template,
  );
}
