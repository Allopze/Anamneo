import { AuditAction, AuditReason, AuditResult } from '../common/types';

export const AUDIT_REASON_LABELS: Record<AuditReason, string> = {
  AUTH_LOGIN: 'Autenticación exitosa',
  AUTH_LOGOUT: 'Cierre de sesión',
  AUTH_LOGIN_REJECTED: 'Credenciales rechazadas',
  AUTH_2FA_ENABLED: 'Activación de autenticación de dos factores',
  AUTH_2FA_DISABLED: 'Desactivación de autenticación de dos factores',
  PATIENT_CREATED: 'Alta de paciente',
  PATIENT_HISTORY_CREATED: 'Alta de historial maestro',
  PATIENT_UPDATED: 'Actualización de paciente',
  PATIENT_ADMIN_UPDATED: 'Actualización administrativa de paciente',
  PATIENT_HISTORY_UPDATED: 'Actualización de historial maestro',
  PATIENT_PROBLEM_CREATED: 'Alta de problema clínico',
  PATIENT_PROBLEM_UPDATED: 'Actualización de problema clínico',
  PATIENT_TASK_CREATED: 'Alta de seguimiento',
  PATIENT_TASK_UPDATED: 'Actualización de seguimiento',
  PATIENT_ARCHIVED: 'Archivo de paciente',
  PATIENT_RESTORED: 'Restauración de paciente',
  PATIENT_EXPORT_CSV: 'Exportación CSV de pacientes',
  ENCOUNTER_CREATED: 'Creación de atención',
  ENCOUNTER_SECTION_UPDATED: 'Actualización de sección clínica',
  ENCOUNTER_COMPLETED: 'Cierre de atención',
  ENCOUNTER_SIGNED: 'Firma de atención',
  ENCOUNTER_REOPENED: 'Reapertura de atención',
  ENCOUNTER_CANCELLED: 'Cancelación de atención',
  ENCOUNTER_REVIEW_STATUS_UPDATED: 'Cambio de estado de revisión',
  ENCOUNTER_DOCUMENT_EXPORTED: 'Exportación documental de atención',
  ATTACHMENT_UPLOADED: 'Carga de adjunto',
  ATTACHMENT_DOWNLOADED: 'Descarga de adjunto',
  ATTACHMENT_DELETED: 'Eliminación de adjunto',
  CONSENT_GRANTED: 'Otorgamiento de consentimiento informado',
  CONSENT_REVOKED: 'Revocación de consentimiento informado',
  USER_INVITATION_CREATED: 'Creación de invitación',
  USER_INVITATION_REVOKED: 'Revocación de invitación',
  USER_UPDATED: 'Actualización de usuario',
  USER_DEACTIVATED: 'Desactivación de usuario',
  USER_PROFILE_UPDATED: 'Actualización de perfil',
  USER_PASSWORD_CHANGED: 'Cambio de contraseña',
  USER_PASSWORD_RESET: 'Reset administrativo de contraseña',
  SETTINGS_UPDATED: 'Actualización de configuración',
  AUDIT_UNSPECIFIED: 'Evento no catalogado',
};

export function inferAuditReason(entityType: string, action: AuditAction, diff: unknown): AuditReason {
  if (entityType === 'Auth' && action === 'LOGIN') return 'AUTH_LOGIN';
  if (entityType === 'Auth' && action === 'LOGOUT') return 'AUTH_LOGOUT';
  if (entityType === 'Auth' && action === 'LOGIN_FAILED') return 'AUTH_LOGIN_REJECTED';
  if (entityType === 'Auth' && action === 'UPDATE' && hasDiffValue(diff, 'totpEnabled', true)) return 'AUTH_2FA_ENABLED';
  if (entityType === 'Auth' && action === 'UPDATE' && hasDiffValue(diff, 'totpEnabled', false)) return 'AUTH_2FA_DISABLED';
  if (entityType === 'Patient' && action === 'CREATE') return 'PATIENT_CREATED';
  if (entityType === 'Patient' && action === 'UPDATE' && hasDiffKey(diff, 'archivedAt')) return 'PATIENT_ARCHIVED';
  if (entityType === 'Patient' && action === 'UPDATE' && hasDiffKey(diff, 'restoredAt')) return 'PATIENT_RESTORED';
  if (entityType === 'Patient' && action === 'UPDATE' && hasDiffScope(diff, 'ADMIN_FIELDS')) return 'PATIENT_ADMIN_UPDATED';
  if (entityType === 'Patient' && action === 'UPDATE' && hasDiffKey(diff, 'adminFields')) return 'PATIENT_ADMIN_UPDATED';
  if (entityType === 'Patient' && action === 'UPDATE') return 'PATIENT_UPDATED';
  if (entityType === 'PatientHistory' && action === 'CREATE') return 'PATIENT_HISTORY_CREATED';
  if (entityType === 'PatientHistory' && action === 'UPDATE') return 'PATIENT_HISTORY_UPDATED';
  if (entityType === 'PatientProblem' && action === 'CREATE') return 'PATIENT_PROBLEM_CREATED';
  if (entityType === 'PatientProblem' && action === 'UPDATE') return 'PATIENT_PROBLEM_UPDATED';
  if (entityType === 'EncounterTask' && action === 'CREATE') return 'PATIENT_TASK_CREATED';
  if (entityType === 'EncounterTask' && action === 'UPDATE') return 'PATIENT_TASK_UPDATED';
  if (entityType === 'PatientArchive' && action === 'DELETE') return 'PATIENT_ARCHIVED';
  if (entityType === 'PatientRestore' && action === 'CREATE') return 'PATIENT_RESTORED';
  if (entityType === 'PatientExport' && action === 'EXPORT') return 'PATIENT_EXPORT_CSV';
  if (entityType === 'Encounter' && action === 'CREATE') return 'ENCOUNTER_CREATED';
  if (entityType === 'Encounter' && action === 'EXPORT') return 'ENCOUNTER_DOCUMENT_EXPORTED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'reviewStatus')) return 'ENCOUNTER_REVIEW_STATUS_UPDATED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'COMPLETADO')) return 'ENCOUNTER_COMPLETED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'FIRMADO')) return 'ENCOUNTER_SIGNED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'EN_PROGRESO')) return 'ENCOUNTER_REOPENED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'CANCELADO')) return 'ENCOUNTER_CANCELLED';
  if (entityType === 'EncounterSection' && action === 'UPDATE') return 'ENCOUNTER_SECTION_UPDATED';
  if (entityType === 'EncounterDocument' && action === 'EXPORT') return 'ENCOUNTER_DOCUMENT_EXPORTED';
  if (entityType === 'Attachment' && action === 'CREATE') return 'ATTACHMENT_UPLOADED';
  if (entityType === 'Attachment' && action === 'DOWNLOAD') return 'ATTACHMENT_DOWNLOADED';
  if (entityType === 'Attachment' && action === 'DELETE') return 'ATTACHMENT_DELETED';
  if (entityType === 'InformedConsent' && action === 'CREATE') return 'CONSENT_GRANTED';
  if (entityType === 'InformedConsent' && action === 'UPDATE') return 'CONSENT_REVOKED';
  if (entityType === 'UserInvitation' && action === 'CREATE') return 'USER_INVITATION_CREATED';
  if (entityType === 'UserInvitation' && action === 'UPDATE') return 'USER_INVITATION_REVOKED';
  if (entityType === 'UserInvitation' && action === 'DELETE') return 'USER_INVITATION_REVOKED';
  if (entityType === 'User' && action === 'UPDATE' && hasDiffKey(diff, 'deactivated')) return 'USER_DEACTIVATED';
  if (entityType === 'User' && action === 'UPDATE' && hasDiffKey(diff, 'profile')) return 'USER_PROFILE_UPDATED';
  if (entityType === 'User' && action === 'UPDATE') return 'USER_UPDATED';
  if (entityType === 'User' && action === 'PASSWORD_CHANGED' && hasDiffKey(diff, 'reset')) return 'USER_PASSWORD_RESET';
  if (entityType === 'User' && action === 'PASSWORD_CHANGED') return 'USER_PASSWORD_CHANGED';
  if (entityType === 'Setting' && action === 'UPDATE') return 'SETTINGS_UPDATED';

  return 'AUDIT_UNSPECIFIED';
}

export function inferAuditResult(action: AuditAction): AuditResult {
  if (action === 'LOGIN_FAILED') {
    return 'REJECTED';
  }

  return 'SUCCESS';
}

function hasDiffKey(diff: unknown, key: string) {
  return typeof diff === 'object' && diff !== null && key in diff;
}

function hasDiffValue(diff: unknown, key: string, value: unknown) {
  if (typeof diff !== 'object' || diff === null || !(key in diff)) {
    return false;
  }

  return (diff as Record<string, unknown>)[key] === value;
}

function hasDiffScope(diff: unknown, value: string) {
  if (typeof diff !== 'object' || diff === null || !('scope' in diff)) {
    return false;
  }

  return (diff as Record<string, unknown>).scope === value;
}
