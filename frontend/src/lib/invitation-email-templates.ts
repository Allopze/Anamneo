export type InvitationTemplatePreset = {
  id: string;
  name: string;
  description: string;
  html: string;
};

export type InvitationTemplatePreviewVariables = {
  clinicName: string;
  recipientEmail: string;
  inviteUrl: string;
  roleLabel: string;
  expirationLabel: string;
  assignedMedicoName: string;
  assignedMedicoSection: string;
  logoUrl: string;
  year: string;
};

const DEFAULT_INVITATION_SUBJECT = 'Invitacion a {{clinicName}}';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapTemplate(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invitacion</title>
  </head>
  <body style="margin:0; padding:0;">${content}</body>
</html>`;
}

export const INVITATION_TEMPLATE_TOKENS = [
  '{{clinicName}}',
  '{{recipientEmail}}',
  '{{inviteUrl}}',
  '{{roleLabel}}',
  '{{expirationLabel}}',
  '{{assignedMedicoName}}',
  '{{assignedMedicoSection}}',
  '{{logoUrl}}',
  '{{year}}',
] as const;

export const INVITATION_TEMPLATE_PRESETS: InvitationTemplatePreset[] = [
  {
    id: 'teal-hero',
    name: 'Hero clinico',
    description: 'Cabecera amplia con logo centrado y boton principal.',
    html: wrapTemplate(`
      <div style="font-family:Arial,sans-serif; background:#f4f7fb; padding:32px 16px; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dbe4ee; border-radius:24px; overflow:hidden;">
          <div style="padding:36px 32px; text-align:center; background:linear-gradient(135deg,#0f766e 0%,#155e75 100%);">
            <img src="{{logoUrl}}" alt="{{clinicName}}" style="display:block; width:180px; max-width:100%; margin:0 auto 20px;" />
            <p style="margin:0; color:#ccfbf1; font-size:13px; letter-spacing:0.18em; text-transform:uppercase;">Bienvenida digital</p>
            <h1 style="margin:14px 0 0; color:#ffffff; font-size:32px; line-height:1.2;">Tu acceso a {{clinicName}} ya esta listo</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 12px; color:#334155;">Hola {{recipientEmail}},</p>
            <p style="margin:0 0 16px; color:#475569;">Te damos la bienvenida. Tu perfil fue preparado como <strong>{{roleLabel}}</strong> y puedes activar tu cuenta cuando quieras.</p>
            {{assignedMedicoSection}}
            <div style="margin:24px 0; padding:18px; border-radius:18px; background:#ecfeff; border:1px solid #bae6fd;">
              <p style="margin:0 0 8px; color:#155e75; font-weight:700;">Fecha limite</p>
              <p style="margin:0; color:#0f172a;">Esta invitacion vence el {{expirationLabel}}.</p>
            </div>
            <a href="{{inviteUrl}}" style="display:inline-block; padding:14px 24px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:700;">Completar registro</a>
            <p style="margin:22px 0 0; color:#64748b; font-size:14px;">Si el boton no abre correctamente, copia este enlace en tu navegador:</p>
            <p style="margin:8px 0 0; color:#0f172a; font-size:14px; word-break:break-all;">{{inviteUrl}}</p>
          </div>
        </div>
      </div>
    `),
  },
  {
    id: 'split-card',
    name: 'Tarjeta editorial',
    description: 'Presentacion en dos bloques con resumen operativo y logo superior.',
    html: wrapTemplate(`
      <div style="font-family:Georgia,'Times New Roman',serif; background:#f8fafc; padding:28px 14px; color:#0f172a;">
        <div style="max-width:700px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:28px; overflow:hidden; box-shadow:0 12px 36px rgba(15,23,42,0.08);">
          <div style="padding:24px 28px; border-bottom:1px solid #e2e8f0; background:#fffdf8;">
            <img src="{{logoUrl}}" alt="{{clinicName}}" style="display:block; width:168px; max-width:100%; margin:0 0 18px;" />
            <p style="margin:0; color:#92400e; font-size:13px; text-transform:uppercase; letter-spacing:0.16em;">Invitacion de bienvenida</p>
            <h1 style="margin:10px 0 0; font-size:34px; line-height:1.15;">Empieza tu experiencia en {{clinicName}}</h1>
          </div>
          <div style="padding:28px; display:block;">
            <p style="margin:0 0 14px; color:#475569; font-family:Arial,sans-serif;">Hola {{recipientEmail}}, tu acceso como <strong>{{roleLabel}}</strong> esta listo para activarse.</p>
            {{assignedMedicoSection}}
            <table role="presentation" width="100%" style="border-collapse:collapse; margin:24px 0; font-family:Arial,sans-serif;">
              <tr>
                <td style="padding:16px; border:1px solid #e2e8f0; border-radius:18px; background:#f8fafc;">
                  <p style="margin:0 0 6px; color:#475569; font-size:12px; text-transform:uppercase; letter-spacing:0.12em;">Accion requerida</p>
                  <p style="margin:0; color:#0f172a; font-size:16px;">Completar tu registro antes del {{expirationLabel}}</p>
                </td>
              </tr>
            </table>
            <a href="{{inviteUrl}}" style="display:inline-block; padding:12px 22px; border-radius:10px; background:#1d4ed8; color:#ffffff; text-decoration:none; font-family:Arial,sans-serif; font-weight:700;">Activar cuenta</a>
            <p style="margin:20px 0 0; color:#64748b; font-size:14px; font-family:Arial,sans-serif;">Tambien puedes usar este enlace directo:</p>
            <p style="margin:8px 0 0; color:#1e293b; font-size:14px; word-break:break-all; font-family:Arial,sans-serif;">{{inviteUrl}}</p>
          </div>
        </div>
      </div>
    `),
  },
  {
    id: 'minimal-band',
    name: 'Minimal corporativa',
    description: 'Diseno compacto con banda superior, logo y lectura rapida.',
    html: wrapTemplate(`
      <div style="font-family:Arial,sans-serif; background:#eef2ff; padding:24px 12px; color:#0f172a;">
        <div style="max-width:620px; margin:0 auto; background:#ffffff; border-radius:22px; overflow:hidden; border:1px solid #cbd5e1;">
          <div style="height:10px; background:linear-gradient(90deg,#1d4ed8 0%,#0891b2 50%,#0f766e 100%);"></div>
          <div style="padding:28px;">
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:24px;">
              <img src="{{logoUrl}}" alt="{{clinicName}}" style="display:block; width:148px; max-width:45%;" />
              <div>
                <p style="margin:0; color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:0.14em;">Welcome pack</p>
                <p style="margin:6px 0 0; color:#0f172a; font-size:20px; font-weight:700;">Bienvenido a {{clinicName}}</p>
              </div>
            </div>
            <p style="margin:0 0 12px; color:#334155;">Hola {{recipientEmail}},</p>
            <p style="margin:0 0 16px; color:#475569;">Tu espacio en la plataforma ya fue habilitado. Ingresaras con perfil de <strong>{{roleLabel}}</strong>.</p>
            {{assignedMedicoSection}}
            <div style="padding:18px; background:#f8fafc; border-radius:16px; border:1px solid #e2e8f0; margin:20px 0;">
              <p style="margin:0 0 8px; color:#0f172a; font-weight:700;">Enlace personal</p>
              <p style="margin:0; color:#334155; word-break:break-all;">{{inviteUrl}}</p>
            </div>
            <a href="{{inviteUrl}}" style="display:inline-block; padding:13px 20px; border-radius:999px; background:#111827; color:#ffffff; text-decoration:none; font-weight:700;">Ingresar y crear contrasena</a>
            <p style="margin:18px 0 0; color:#64748b; font-size:14px;">Disponible hasta el {{expirationLabel}}.</p>
            <p style="margin:24px 0 0; color:#94a3b8; font-size:12px;">{{year}} {{clinicName}}</p>
          </div>
        </div>
      </div>
    `),
  },
];

export function getDefaultInvitationTemplateHtml() {
  return INVITATION_TEMPLATE_PRESETS[0]?.html || '';
}

export function getDefaultInvitationSubjectTemplate() {
  return DEFAULT_INVITATION_SUBJECT;
}

export function renderInvitationTextTemplate(
  template: string,
  variables: InvitationTemplatePreviewVariables,
) {
  const source = template.trim() || getDefaultInvitationSubjectTemplate();
  const replacements: Record<string, string> = {
    clinicName: variables.clinicName,
    recipientEmail: variables.recipientEmail,
    inviteUrl: variables.inviteUrl,
    roleLabel: variables.roleLabel,
    expirationLabel: variables.expirationLabel,
    assignedMedicoName: variables.assignedMedicoName,
    assignedMedicoSection: variables.assignedMedicoName,
    logoUrl: variables.logoUrl,
    year: variables.year,
  };

  return Object.entries(replacements).reduce(
    (rendered, [key, value]) => rendered.split(`{{${key}}}`).join(value),
    source,
  );
}

export function renderInvitationTemplatePreview(
  templateHtml: string,
  variables: InvitationTemplatePreviewVariables,
) {
  const source = templateHtml.trim() || getDefaultInvitationTemplateHtml();
  const replacements: Record<string, string> = {
    clinicName: escapeHtml(variables.clinicName),
    recipientEmail: escapeHtml(variables.recipientEmail),
    inviteUrl: escapeHtml(variables.inviteUrl),
    roleLabel: escapeHtml(variables.roleLabel),
    expirationLabel: escapeHtml(variables.expirationLabel),
    assignedMedicoName: escapeHtml(variables.assignedMedicoName),
    assignedMedicoSection: variables.assignedMedicoSection,
    logoUrl: escapeHtml(variables.logoUrl),
    year: escapeHtml(variables.year),
  };

  return Object.entries(replacements).reduce(
    (rendered, [key, value]) => rendered.split(`{{${key}}}`).join(value),
    source,
  );
}