export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  requestId?: string | null;
  action: string;
  reason?: string | null;
  result: string;
  diff: string | null;
  timestamp: string;
}

export interface AdminUserRow {
  id: string;
  nombre: string;
  email: string;
}

export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: 'Creación', color: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'Actualización', color: 'border border-status-yellow/60 bg-status-yellow/30 text-accent-text' },
  DELETE: { label: 'Eliminación', color: 'bg-status-red/20 text-status-red' },
  EXPORT: { label: 'Exportación', color: 'bg-sky-100 text-sky-700' },
  DOWNLOAD: { label: 'Descarga', color: 'bg-amber-100 text-amber-700' },
  PASSWORD_CHANGED: { label: 'Cambio de contraseña', color: 'bg-orange-100 text-orange-700' },
  LOGIN: { label: 'Inicio de sesión', color: 'bg-emerald-100 text-emerald-700' },
  LOGOUT: { label: 'Cierre de sesión', color: 'bg-slate-200 text-slate-700' },
  LOGIN_FAILED: { label: 'Login fallido', color: 'bg-rose-100 text-rose-700' },
};

export const ENTITY_LABELS: Record<string, string> = {
  Patient: 'Paciente',
  Encounter: 'Atención',
  EncounterSection: 'Sección',
  User: 'Usuario',
  ConditionCatalog: 'Catálogo',
  ConditionCatalogLocal: 'Catálogo local',
  MedicationCatalog: 'Catálogo de medicamentos',
  Attachment: 'Adjunto',
  UserInvitation: 'Invitación',
  PatientExport: 'Exportación pacientes',
  Auth: 'Autenticación',
  Setting: 'Configuración',
};

export const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Exitoso', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rechazado', color: 'bg-amber-100 text-amber-700' },
  ERROR: { label: 'Error', color: 'bg-status-red/20 text-status-red' },
};

export const REASON_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'Login',
  AUTH_LOGOUT: 'Logout',
  AUTH_LOGIN_REJECTED: 'Login rechazado',
  AUTH_2FA_ENABLED: '2FA activado',
  AUTH_2FA_DISABLED: '2FA desactivado',
  AUTH_2FA_RECOVERY_CODES_REGENERATED: 'Recovery codes 2FA regenerados',
  PATIENT_CREATED: 'Alta de paciente',
  PATIENT_UPDATED: 'Actualización de paciente',
  PATIENT_ADMIN_UPDATED: 'Actualización administrativa',
  PATIENT_HISTORY_UPDATED: 'Historial maestro',
  PATIENT_PROBLEM_CREATED: 'Alta de problema',
  PATIENT_PROBLEM_UPDATED: 'Actualización de problema',
  PATIENT_TASK_CREATED: 'Alta de seguimiento',
  PATIENT_TASK_UPDATED: 'Actualización de seguimiento',
  PATIENT_ARCHIVED: 'Archivo de paciente',
  PATIENT_RESTORED: 'Restauración de paciente',
  PATIENT_EXPORT_CSV: 'Exportación de pacientes',
  ENCOUNTER_CREATED: 'Creación de atención',
  ENCOUNTER_SECTION_UPDATED: 'Actualización de sección',
  ENCOUNTER_COMPLETED: 'Cierre de atención',
  ENCOUNTER_SIGNED: 'Firma de atención',
  ENCOUNTER_REOPENED: 'Reapertura de atención',
  ENCOUNTER_CANCELLED: 'Cancelación de atención',
  ENCOUNTER_REVIEW_STATUS_UPDATED: 'Cambio de revisión',
  ENCOUNTER_DOCUMENT_EXPORTED: 'Exportación documental',
  ATTACHMENT_UPLOADED: 'Carga de adjunto',
  ATTACHMENT_DOWNLOADED: 'Descarga de adjunto',
  ATTACHMENT_DELETED: 'Borrado de adjunto',
  CONSENT_GRANTED: 'Consentimiento otorgado',
  CONSENT_REVOKED: 'Consentimiento revocado',
  USER_INVITATION_CREATED: 'Creación de invitación',
  USER_INVITATION_REVOKED: 'Revocación de invitación',
  USER_UPDATED: 'Actualización de usuario',
  USER_DEACTIVATED: 'Desactivación de usuario',
  USER_PROFILE_UPDATED: 'Actualización de perfil',
  USER_PASSWORD_CHANGED: 'Cambio de contraseña',
  USER_PASSWORD_RESET: 'Reset de contraseña',
  CONDITION_CSV_IMPORTED: 'Importación CSV de catálogo global',
  MEDICATION_CSV_IMPORTED: 'Importación CSV de catálogo de medicamentos',
  SETTINGS_UPDATED: 'Actualización de ajustes',
  AUDIT_UNSPECIFIED: 'Sin clasificar',
};
