import { AuditAction, AuditReason, AuditResult } from '../common/types';

export const AUDIT_REASON_LABELS: Record<AuditReason, string> = {
  AUTH_LOGIN: 'Autenticación exitosa',
  AUTH_LOGOUT: 'Cierre de sesión',
  AUTH_LOGIN_REJECTED: 'Credenciales rechazadas',
  AUTH_2FA_ENABLED: 'Activación de autenticación de dos factores',
  AUTH_2FA_DISABLED: 'Desactivación de autenticación de dos factores',
  AUTH_2FA_RECOVERY_CODES_REGENERATED: 'Regeneración de códigos de recuperación 2FA',
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
  PATIENT_RECORD_VIEWED: 'Consulta de ficha de paciente',
  PATIENT_CLINICAL_SUMMARY_VIEWED: 'Consulta de resumen clínico de paciente',
  PATIENT_LIST_VIEWED: 'Consulta de listado de pacientes',
  PATIENT_DUPLICATES_SEARCHED: 'Búsqueda de duplicados potenciales de pacientes',
  PATIENT_ADMIN_SUMMARY_VIEWED: 'Consulta de resumen administrativo de paciente',
  PATIENT_TIMELINE_VIEWED: 'Consulta de línea de tiempo de paciente',
  PATIENT_OPERATIONAL_HISTORY_VIEWED: 'Consulta de historial operativo de paciente',
  PATIENT_TASKS_VIEWED: 'Consulta de bandeja de tareas de paciente',
  PATIENT_EXPORT_CSV: 'Exportación CSV de pacientes',
  PATIENT_LONGITUDINAL_EXPORTED: 'Exportación de historial clínico longitudinal',
  PATIENT_BUNDLE_EXPORTED: 'Exportación de paquete clínico de paciente',
  CLINICAL_ANALYTICS_CSV_EXPORTED: 'Exportación CSV de casos clínicos analíticos',
  CLINICAL_ANALYTICS_SUMMARY_VIEWED: 'Consulta de resumen analítico clínico',
  CLINICAL_ANALYTICS_CASES_VIEWED: 'Consulta de casos analíticos clínicos',
  CLINICAL_ANALYTICS_SUMMARY_CSV_EXPORTED: 'Exportación CSV del resumen clínico analítico',
  CLINICAL_ANALYTICS_SUMMARY_REPORT_EXPORTED: 'Exportación de reporte Markdown del resumen clínico analítico',
  ENCOUNTER_CREATED: 'Creación de atención',
  ENCOUNTER_SECTION_UPDATED: 'Actualización de sección clínica',
  ENCOUNTER_COMPLETED: 'Cierre de atención',
  ENCOUNTER_SIGNED: 'Firma de atención',
  ENCOUNTER_REOPENED: 'Reapertura de atención',
  ENCOUNTER_CANCELLED: 'Cancelación de atención',
  ENCOUNTER_REVIEW_STATUS_UPDATED: 'Cambio de estado de revisión',
  ENCOUNTER_RECORD_VIEWED: 'Consulta de atención clínica',
  ENCOUNTER_TIMELINE_VIEWED: 'Consulta de línea de tiempo de atenciones',
  ENCOUNTER_DOCUMENT_EXPORTED: 'Exportación documental de atención',
  ATTACHMENT_UPLOADED: 'Carga de adjunto',
  ATTACHMENT_LIST_VIEWED: 'Consulta de listado de adjuntos',
  ATTACHMENT_DOWNLOADED: 'Descarga de adjunto',
  ATTACHMENT_DELETED: 'Eliminación de adjunto',
  ATTACHMENT_SOFT_DELETED: 'Adjunto movido a papelera',
  ALERT_CREATED: 'Creación de alerta clínica',
  ALERT_LIST_VIEWED: 'Consulta de alertas clínicas',
  ALERT_ACKNOWLEDGED: 'Reconocimiento de alerta clínica',
  CONSENT_LIST_VIEWED: 'Consulta de consentimientos informados',
  CONSENT_GRANTED: 'Otorgamiento de consentimiento informado',
  CONSENT_REVOKED: 'Revocación de consentimiento informado',
  USER_INVITATION_CREATED: 'Creación de invitación',
  USER_INVITATION_REVOKED: 'Revocación de invitación',
  USER_UPDATED: 'Actualización de usuario',
  USER_DEACTIVATED: 'Desactivación de usuario',
  USER_PROFILE_UPDATED: 'Actualización de perfil',
  USER_PASSWORD_CHANGED: 'Cambio de contraseña',
  USER_PASSWORD_RESET: 'Reset administrativo de contraseña',
  USER_PASSWORD_RESET_REQUESTED: 'Solicitud de reset de contraseña por email',
  USER_PASSWORD_RESET_VIA_EMAIL: 'Reset de contraseña confirmado por email',
  PATIENT_DATA_EXPORTED_REGULATORY: 'Exportación regulatoria de datos de paciente (Ley 19.628/21.719)',
  PATIENT_RECORD_PURGED_REGULATORY: 'Borrado regulatorio de ficha clínica',
  ATTACHMENT_QUARANTINED: 'Adjunto en cuarentena (AV scan)',
  TEXT_TEMPLATE_CREATED: 'Creación de plantilla clínica',
  TEXT_TEMPLATE_UPDATED: 'Actualización de plantilla clínica',
  TEXT_TEMPLATE_DELETED: 'Eliminación de plantilla clínica',
  CONDITION_CSV_IMPORTED: 'Importación CSV de catálogo global',
  MEDICATION_CSV_IMPORTED: 'Importación CSV de catálogo de medicamentos',
  SETTINGS_UPDATED: 'Actualización de configuración',
  // Ley 21.719 - consentimiento del titular (Art 12)
  PATIENT_DATA_CONSENT_GRANTED: 'Consentimiento de tratamiento de datos otorgado por el titular (Ley 21.719 Art 12)',
  PATIENT_DATA_CONSENT_REVOKED: 'Consentimiento de tratamiento de datos revocado por el titular (Ley 21.719 Art 12)',
  PATIENT_DATA_CONSENT_LIST_VIEWED: 'Consulta de consentimientos de tratamiento de datos del titular',
  // Ley 21.719 - derechos del titular (Art 4-11)
  PATIENT_RIGHT_REQUESTED: 'Solicitud de derecho del titular recibida (Ley 21.719 Art 4)',
  PATIENT_RIGHT_RESOLVED_ACCEPTED: 'Solicitud de derecho del titular resuelta y aceptada',
  PATIENT_RIGHT_RESOLVED_REJECTED: 'Solicitud de derecho del titular resuelta y rechazada con causa fundada',
  PATIENT_RIGHT_EXPIRED: 'Solicitud de derecho del titular vencida sin respuesta (Ley 21.719 Art 11)',
  PATIENT_RIGHT_LIST_VIEWED: 'Consulta de bandeja de solicitudes de derechos del titular',
  PATIENT_DATA_REQUEST_EXPORT_LINK_CREATED: 'Enlace temporal de descarga de ficha clínica creado',
  PATIENT_DATA_REQUEST_EXPORT_DOWNLOADED: 'Ficha clínica descargada por enlace temporal',
  PATIENT_DATA_REQUEST_EXPORT_EXPIRED: 'Enlace temporal de descarga de ficha clínica expirado',
  PATIENT_DATA_REQUEST_EXPORT_REVOKED: 'Enlace temporal de descarga de ficha clínica revocado',
  PATIENT_RIGHT_VIEWED: 'Consulta de detalle de solicitud de derecho del titular',
  PATIENT_RIGHT_ADMIN_UPDATED: 'Actualización administrativa de solicitud de derecho del titular',
  PATIENT_RIGHT_EXTENDED: 'Prórroga de plazo aplicada a solicitud de derecho del titular (Ley 21.719 Art 11)',
  // Ley 21.719 - bloqueo temporal (Art 8 ter)
  PATIENT_BLOCKED: 'Bloqueo temporal de tratamiento de paciente (Ley 21.719 Art 8 ter)',
  PATIENT_UNBLOCKED: 'Levantamiento de bloqueo temporal de tratamiento de paciente',
  PATIENT_PORTAL_LOGIN: 'Inicio de sesión en portal paciente',
  PATIENT_PORTAL_RECORD_VIEWED: 'Ficha de paciente consultada desde portal paciente',
  PATIENT_PORTAL_ENCOUNTER_VIEWED: 'Atención consultada desde portal paciente',
  PATIENT_PORTAL_DOCUMENT_DOWNLOADED: 'Documento clínico descargado desde portal paciente',
  PATIENT_PORTAL_DATA_REQUEST_CREATED: 'Solicitud de derechos creada desde portal paciente',
  // Ley 21.719 - brechas (Art 14 sexies)
  DATA_BREACH_DETECTED: 'Vulneración a medidas de seguridad detectada (Ley 21.719 Art 14 sexies)',
  DATA_BREACH_REPORTED_TO_AGENCY: 'Vulneración reportada a la Agencia de Protección de Datos Personales',
  DATA_BREACH_NOTIFIED_TO_SUBJECTS: 'Vulneración notificada a titulares afectados',
  DATA_BREACH_CLOSED: 'Investigación de vulneración cerrada',
  DATA_BREACH_ASSESSED: 'Evaluación de riesgo razonable de vulneración registrada (Ley 21.719 Art 14 sexies)',
  DATA_BREACH_LIST_VIEWED: 'Consulta de listado de vulneraciones',
  DATA_BREACH_VIEWED: 'Consulta de detalle de vulneración',
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
  if (entityType === 'Patient' && action === 'READ' && hasDiffScope(diff, 'CLINICAL_SUMMARY')) return 'PATIENT_CLINICAL_SUMMARY_VIEWED';
  if (entityType === 'Patient' && action === 'READ') return 'PATIENT_RECORD_VIEWED';
  if (entityType === 'PatientList' && action === 'READ') return 'PATIENT_LIST_VIEWED';
  if (entityType === 'PatientDuplicatesSearch' && action === 'READ') return 'PATIENT_DUPLICATES_SEARCHED';
  if (entityType === 'PatientAdminSummary' && action === 'READ') return 'PATIENT_ADMIN_SUMMARY_VIEWED';
  if (entityType === 'PatientTimeline' && action === 'READ') return 'PATIENT_TIMELINE_VIEWED';
  if (entityType === 'PatientOperationalHistory' && action === 'READ') return 'PATIENT_OPERATIONAL_HISTORY_VIEWED';
  if (entityType === 'PatientTaskInbox' && action === 'READ') return 'PATIENT_TASKS_VIEWED';
  if (entityType === 'PatientHistory' && action === 'CREATE') return 'PATIENT_HISTORY_CREATED';
  if (entityType === 'PatientHistory' && action === 'UPDATE') return 'PATIENT_HISTORY_UPDATED';
  if (entityType === 'PatientProblem' && action === 'CREATE') return 'PATIENT_PROBLEM_CREATED';
  if (entityType === 'PatientProblem' && action === 'UPDATE') return 'PATIENT_PROBLEM_UPDATED';
  if (entityType === 'EncounterTask' && action === 'CREATE') return 'PATIENT_TASK_CREATED';
  if (entityType === 'EncounterTask' && action === 'UPDATE') return 'PATIENT_TASK_UPDATED';
  if (entityType === 'PatientArchive' && action === 'DELETE') return 'PATIENT_ARCHIVED';
  if (entityType === 'PatientRestore' && action === 'CREATE') return 'PATIENT_RESTORED';
  if (entityType === 'PatientExport' && action === 'EXPORT') return 'PATIENT_EXPORT_CSV';
  if (entityType === 'ClinicalAnalyticsCasesExport' && action === 'EXPORT') return 'CLINICAL_ANALYTICS_CSV_EXPORTED';
  if (entityType === 'ClinicalAnalyticsSummary' && action === 'READ') return 'CLINICAL_ANALYTICS_SUMMARY_VIEWED';
  if (entityType === 'ClinicalAnalyticsCases' && action === 'READ') return 'CLINICAL_ANALYTICS_CASES_VIEWED';
  if (entityType === 'ClinicalAnalyticsSummaryExport' && action === 'EXPORT') return 'CLINICAL_ANALYTICS_SUMMARY_CSV_EXPORTED';
  if (entityType === 'ClinicalAnalyticsSummaryReportExport' && action === 'EXPORT') return 'CLINICAL_ANALYTICS_SUMMARY_REPORT_EXPORTED';
  if (entityType === 'Encounter' && action === 'CREATE') return 'ENCOUNTER_CREATED';
  if (entityType === 'Encounter' && action === 'READ' && hasDiffScope(diff, 'TIMELINE')) return 'ENCOUNTER_TIMELINE_VIEWED';
  if (entityType === 'Encounter' && action === 'READ') return 'ENCOUNTER_RECORD_VIEWED';
  if (entityType === 'Encounter' && action === 'EXPORT') return 'ENCOUNTER_DOCUMENT_EXPORTED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'reviewStatus')) return 'ENCOUNTER_REVIEW_STATUS_UPDATED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'COMPLETADO')) return 'ENCOUNTER_COMPLETED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'FIRMADO')) return 'ENCOUNTER_SIGNED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'EN_PROGRESO')) return 'ENCOUNTER_REOPENED';
  if (entityType === 'Encounter' && action === 'UPDATE' && hasDiffKey(diff, 'status') && hasDiffValue(diff, 'status', 'CANCELADO')) return 'ENCOUNTER_CANCELLED';
  if (entityType === 'EncounterSection' && action === 'UPDATE') return 'ENCOUNTER_SECTION_UPDATED';
  if (entityType === 'EncounterDocument' && action === 'EXPORT') return 'ENCOUNTER_DOCUMENT_EXPORTED';
  if (entityType === 'Attachment' && action === 'CREATE') return 'ATTACHMENT_UPLOADED';
  if (entityType === 'Attachment' && action === 'READ') return 'ATTACHMENT_LIST_VIEWED';
  if (entityType === 'Attachment' && action === 'DOWNLOAD') return 'ATTACHMENT_DOWNLOADED';
  if (entityType === 'Attachment' && action === 'DELETE') return 'ATTACHMENT_DELETED';
  if (entityType === 'Attachment' && action === 'SOFT_DELETE') return 'ATTACHMENT_SOFT_DELETED';
  if (entityType === 'ClinicalAlert' && action === 'CREATE') return 'ALERT_CREATED';
  if (entityType === 'ClinicalAlert' && action === 'READ') return 'ALERT_LIST_VIEWED';
  if (entityType === 'ClinicalAlert' && action === 'UPDATE') return 'ALERT_ACKNOWLEDGED';
  if (entityType === 'ClinicalConsent' && action === 'READ') return 'CONSENT_LIST_VIEWED';
  if (entityType === 'ClinicalConsent' && action === 'CREATE') return 'CONSENT_GRANTED';
  if (entityType === 'ClinicalConsent' && action === 'UPDATE') return 'CONSENT_REVOKED';
  if (entityType === 'UserInvitation' && action === 'CREATE') return 'USER_INVITATION_CREATED';
  if (entityType === 'UserInvitation' && action === 'UPDATE') return 'USER_INVITATION_REVOKED';
  if (entityType === 'UserInvitation' && action === 'DELETE') return 'USER_INVITATION_REVOKED';
  if (entityType === 'User' && action === 'UPDATE' && hasDiffKey(diff, 'deactivated')) return 'USER_DEACTIVATED';
  if (entityType === 'User' && action === 'UPDATE' && hasDiffKey(diff, 'profile')) return 'USER_PROFILE_UPDATED';
  if (entityType === 'User' && action === 'UPDATE') return 'USER_UPDATED';
  if (entityType === 'User' && action === 'PASSWORD_CHANGED' && hasDiffScope(diff, 'EMAIL_RESET_REQUEST')) return 'USER_PASSWORD_RESET_REQUESTED';
  if (entityType === 'User' && action === 'PASSWORD_CHANGED' && hasDiffScope(diff, 'EMAIL_RESET')) return 'USER_PASSWORD_RESET_VIA_EMAIL';
  if (entityType === 'User' && action === 'PASSWORD_CHANGED' && hasDiffKey(diff, 'reset')) return 'USER_PASSWORD_RESET';
  if (entityType === 'User' && action === 'PASSWORD_CHANGED') return 'USER_PASSWORD_CHANGED';
  if (entityType === 'TextTemplate' && action === 'CREATE') return 'TEXT_TEMPLATE_CREATED';
  if (entityType === 'TextTemplate' && action === 'UPDATE') return 'TEXT_TEMPLATE_UPDATED';
  if (entityType === 'TextTemplate' && action === 'DELETE') return 'TEXT_TEMPLATE_DELETED';
  if (entityType === 'ConditionCatalog' && action === 'UPDATE' && hasDiffScope(diff, 'CSV_IMPORT')) return 'CONDITION_CSV_IMPORTED';
  if (entityType === 'MedicationCatalog' && action === 'UPDATE' && hasDiffScope(diff, 'CSV_IMPORT')) return 'MEDICATION_CSV_IMPORTED';
  if (entityType === 'Setting' && action === 'UPDATE') return 'SETTINGS_UPDATED';

  // Ley 21.719
  if (entityType === 'PatientDataProcessingConsent' && action === 'CREATE') return 'PATIENT_DATA_CONSENT_GRANTED';
  if (entityType === 'PatientDataProcessingConsent' && action === 'UPDATE') return 'PATIENT_DATA_CONSENT_REVOKED';
  if (entityType === 'PatientDataProcessingConsent' && action === 'READ') return 'PATIENT_DATA_CONSENT_LIST_VIEWED';
  if (entityType === 'PatientDataRequest' && action === 'CREATE') return 'PATIENT_RIGHT_REQUESTED';
  if (entityType === 'PatientDataRequest' && action === 'UPDATE' && hasDiffValue(diff, 'status', 'RESUELTA_ACEPTADA')) return 'PATIENT_RIGHT_RESOLVED_ACCEPTED';
  if (entityType === 'PatientDataRequest' && action === 'UPDATE' && hasDiffValue(diff, 'status', 'RESUELTA_RECHAZADA')) return 'PATIENT_RIGHT_RESOLVED_REJECTED';
  if (entityType === 'PatientDataRequest' && action === 'UPDATE' && hasDiffValue(diff, 'status', 'VENCIDA')) return 'PATIENT_RIGHT_EXPIRED';
  if (entityType === 'PatientDataRequest' && action === 'UPDATE' && hasDiffKey(diff, 'extension')) return 'PATIENT_RIGHT_EXTENDED';
  if (entityType === 'PatientDataRequest' && action === 'UPDATE') return 'PATIENT_RIGHT_ADMIN_UPDATED';
  if (entityType === 'PatientDataRequest' && action === 'READ' && hasDiffKey(diff, 'count')) return 'PATIENT_RIGHT_LIST_VIEWED';
  if (entityType === 'PatientDataRequest' && action === 'READ') return 'PATIENT_RIGHT_VIEWED';
  if (entityType === 'PatientDataRequestDownload' && action === 'CREATE') return 'PATIENT_DATA_REQUEST_EXPORT_LINK_CREATED';
  if (entityType === 'PatientDataRequestDownload' && action === 'READ') return 'PATIENT_DATA_REQUEST_EXPORT_DOWNLOADED';
  if (entityType === 'Patient' && action === 'UPDATE' && hasDiffKey(diff, 'blockedAt') && !hasDiffValue(diff, 'blockedAt', null)) return 'PATIENT_BLOCKED';
  if (entityType === 'Patient' && action === 'UPDATE' && hasDiffKey(diff, 'blockedAt') && hasDiffValue(diff, 'blockedAt', null)) return 'PATIENT_UNBLOCKED';
  if (entityType === 'DataBreachIncident' && action === 'CREATE') return 'DATA_BREACH_DETECTED';
  if (entityType === 'DataBreachIncident' && action === 'UPDATE' && hasDiffKey(diff, 'reportedToAgencyAt')) return 'DATA_BREACH_REPORTED_TO_AGENCY';
  if (entityType === 'DataBreachIncident' && action === 'UPDATE' && hasDiffKey(diff, 'reportedToSubjectsAt')) return 'DATA_BREACH_NOTIFIED_TO_SUBJECTS';
  if (entityType === 'DataBreachIncident' && action === 'UPDATE' && hasDiffValue(diff, 'status', 'CERRADO')) return 'DATA_BREACH_CLOSED';
  if (entityType === 'DataBreachIncident' && action === 'UPDATE' && hasDiffKey(diff, 'assessment')) return 'DATA_BREACH_ASSESSED';
  if (entityType === 'DataBreachIncident' && action === 'READ' && hasDiffKey(diff, 'count')) return 'DATA_BREACH_LIST_VIEWED';
  if (entityType === 'DataBreachIncident' && action === 'READ') return 'DATA_BREACH_VIEWED';

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
