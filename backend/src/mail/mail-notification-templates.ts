import { escapeHtml } from './mail-helpers';
type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};
export type DataRequestAcknowledgementPayload = {
  requesterName: string;
  requestId: string;
  requestType: string;
  dueDate: Date;
};
export type DataRequestResolvedPayload = {
  requesterName: string;
  requestId: string;
  requestType: string;
  resolutionNote: string;
};
export type DataRequestRejectedPayload = {
  requesterName: string;
  requestId: string;
  requestType: string;
  reason: string;
};
export type DataRequestExtendedPayload = {
  requesterName: string;
  requestId: string;
  requestType: string;
  newDueDate: Date;
  reason: string;
};
export type DataRequestExportLinkPayload = {
  requesterName: string;
  requestId: string;
  downloadUrl: string;
  expiresAt: Date;
  maxDownloads: number;
};
export type PatientPortalInvitePayload = {
  patientName: string;
  activationUrl: string;
  expiresAt: Date;
};
export type PatientPortalPasswordResetPayload = {
  resetUrl: string;
  expiresAt: Date;
};
export type BreachNotificationPayload = {
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
};
function formatDateCL(date: Date): string {
  return date.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}
export function buildDataRequestAcknowledgementEmail(
  payload: DataRequestAcknowledgementPayload,
): RenderedEmail {
  const subject = `Acuse de recibo — solicitud de derechos (Ley 21.719) #${payload.requestId.slice(0, 8)}`;
  const text = [
    `Hola ${payload.requesterName},`,
    '',
    `Recibimos tu solicitud de tipo ${payload.requestType} bajo la Ley 21.719.`,
    `Número de seguimiento interno: ${payload.requestId}`,
    `Plazo legal de respuesta: ${formatDateCL(payload.dueDate)} (30 días corridos, Art 11).`,
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
    <p>Plazo legal de respuesta: <strong>${escapeHtml(formatDateCL(payload.dueDate))}</strong> (30 días corridos, Art 11).</p>
    <p>Verificaremos tu identidad y responderemos dentro del plazo.</p>
    <p style="color:#64748b;font-size:13px;">Si no realizaste esta solicitud, escríbenos de inmediato.</p>
  </div>`;
  return { subject, text, html };
}
export function buildDataRequestResolvedEmail(payload: DataRequestResolvedPayload): RenderedEmail {
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
  return { subject, text, html };
}
export function buildDataRequestRejectedEmail(payload: DataRequestRejectedPayload): RenderedEmail {
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
  return { subject, text, html };
}
export function buildDataRequestExtendedEmail(payload: DataRequestExtendedPayload): RenderedEmail {
  const subject = `Prórroga de plazo en tu solicitud (Ley 21.719) #${payload.requestId.slice(0, 8)}`;
  const text = [
    `Hola ${payload.requesterName},`,
    '',
    `Extendemos por 30 días corridos adicionales (Art 11) el plazo para responder a tu solicitud de tipo ${payload.requestType}.`,
    `Nuevo plazo máximo de respuesta: ${formatDateCL(payload.newDueDate)}.`,
    '',
    'Motivo de la prórroga:',
    payload.reason,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
    <h2>Prórroga aplicada</h2>
    <p>Hola ${escapeHtml(payload.requesterName)},</p>
    <p>Extendemos por 30 días corridos adicionales (Art 11) el plazo para responder a tu solicitud de tipo <strong>${escapeHtml(payload.requestType)}</strong>.</p>
    <p>Nuevo plazo máximo: <strong>${escapeHtml(formatDateCL(payload.newDueDate))}</strong>.</p>
    <p style="white-space:pre-line;">${escapeHtml(payload.reason)}</p>
  </div>`;
  return { subject, text, html };
}
export function buildDataRequestExportLinkEmail(payload: DataRequestExportLinkPayload): RenderedEmail {
  const subject = `Descarga segura de ficha clínica #${payload.requestId.slice(0, 8)}`;
  const text = [
    `Hola ${payload.requesterName},`,
    '',
    'Tu copia de ficha clínica está disponible mediante un enlace temporal.',
    `Enlace: ${payload.downloadUrl}`,
    `Vence: ${formatDateCL(payload.expiresAt)}.`,
    `Máximo de descargas: ${payload.maxDownloads}.`,
    '',
    'Por seguridad, la descarga solicitará el RUT asociado a la solicitud.',
    'Si no solicitaste esta copia, responde a este correo de inmediato.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
    <h2>Descarga segura de ficha clínica</h2>
    <p>Hola ${escapeHtml(payload.requesterName)},</p>
    <p>Tu copia de ficha clínica está disponible mediante un enlace temporal.</p>
    <p><a href="${escapeHtml(payload.downloadUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:600;">Descargar ficha clínica</a></p>
    <p>Vence: <strong>${escapeHtml(formatDateCL(payload.expiresAt))}</strong>.</p>
    <p>Máximo de descargas: <strong>${payload.maxDownloads}</strong>.</p>
    <p style="margin:8px 0 0; color:#0f172a; font-size:14px; word-break:break-all;">${escapeHtml(payload.downloadUrl)}</p>
    <p style="color:#64748b;font-size:13px;">Por seguridad, la descarga solicitará el RUT asociado a la solicitud. Si no solicitaste esta copia, responde a este correo de inmediato.</p>
  </div>`;
  return { subject, text, html };
}
export function buildPatientPortalInviteEmail(payload: PatientPortalInvitePayload): RenderedEmail {
  const subject = 'Invitación al portal paciente Anamneo';
  const text = [
    'Hola,',
    '',
    `Se creó una invitación para acceder al portal paciente de ${payload.patientName}.`,
    `Activa la cuenta aquí: ${payload.activationUrl}`,
    `El enlace vence: ${formatDateCL(payload.expiresAt)}.`,
    '',
    'Si no esperabas esta invitación, ignora este correo y avisa a la clínica.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
    <h2>Invitación al portal paciente</h2>
    <p>Se creó una invitación para acceder al portal paciente de <strong>${escapeHtml(payload.patientName)}</strong>.</p>
    <p><a href="${escapeHtml(payload.activationUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:600;">Activar cuenta</a></p>
    <p>El enlace vence: <strong>${escapeHtml(formatDateCL(payload.expiresAt))}</strong>.</p>
    <p style="word-break:break-all;">${escapeHtml(payload.activationUrl)}</p>
    <p style="color:#64748b;font-size:13px;">Si no esperabas esta invitación, ignora este correo y avisa a la clínica.</p>
  </div>`;
  return { subject, text, html };
}
export function buildPatientPortalPasswordResetEmail(
  payload: PatientPortalPasswordResetPayload,
): RenderedEmail {
  const subject = 'Restablecer contraseña del portal paciente';
  const text = [
    'Hola,',
    '',
    'Recibimos una solicitud para restablecer tu contraseña del portal paciente.',
    `Enlace: ${payload.resetUrl}`,
    `Vence: ${formatDateCL(payload.expiresAt)}.`,
    '',
    'Si no solicitaste este cambio, ignora este correo.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
    <h2>Restablecer contraseña</h2>
    <p>Recibimos una solicitud para restablecer tu contraseña del portal paciente.</p>
    <p><a href="${escapeHtml(payload.resetUrl)}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#0f766e; color:#ffffff; text-decoration:none; font-weight:600;">Restablecer contraseña</a></p>
    <p>Vence: <strong>${escapeHtml(formatDateCL(payload.expiresAt))}</strong>.</p>
    <p style="word-break:break-all;">${escapeHtml(payload.resetUrl)}</p>
  </div>`;
  return { subject, text, html };
}
export function buildBreachNotificationEmail(payload: BreachNotificationPayload): RenderedEmail {
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
    'Le informamos que hemos detectado un incidente que afecta a la seguridad de sus datos personales registrados en Anamneo.',
    `Fecha o período estimado del incidente: ${formatDateCL(payload.detectedAt)}.`,
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
    <p><strong>Fecha o período estimado:</strong> ${escapeHtml(formatDateCL(payload.detectedAt))}</p>
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
  return { subject, text, html };
}
