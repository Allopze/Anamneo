import { inferAuditReason, inferAuditResult } from './audit-catalog';

describe('audit-catalog', () => {
  it.each([
    ['Patient', 'CREATE', {}, 'PATIENT_CREATED'],
    ['PatientHistory', 'CREATE', {}, 'PATIENT_HISTORY_CREATED'],
    ['Patient', 'UPDATE', { archivedAt: '2026-03-31T12:00:00.000Z' }, 'PATIENT_ARCHIVED'],
    ['Patient', 'UPDATE', { restoredAt: '2026-03-31T12:00:00.000Z' }, 'PATIENT_RESTORED'],
    ['Patient', 'UPDATE', { scope: 'ADMIN_FIELDS' }, 'PATIENT_ADMIN_UPDATED'],
    ['Patient', 'READ', { scope: 'PATIENT_RECORD' }, 'PATIENT_RECORD_VIEWED'],
    ['Patient', 'READ', { scope: 'CLINICAL_SUMMARY' }, 'PATIENT_CLINICAL_SUMMARY_VIEWED'],
    ['PatientList', 'READ', {}, 'PATIENT_LIST_VIEWED'],
    ['PatientDuplicatesSearch', 'READ', {}, 'PATIENT_DUPLICATES_SEARCHED'],
    ['PatientAdminSummary', 'READ', {}, 'PATIENT_ADMIN_SUMMARY_VIEWED'],
    ['PatientTimeline', 'READ', {}, 'PATIENT_TIMELINE_VIEWED'],
    ['PatientOperationalHistory', 'READ', {}, 'PATIENT_OPERATIONAL_HISTORY_VIEWED'],
    ['PatientTaskInbox', 'READ', {}, 'PATIENT_TASKS_VIEWED'],
    ['Encounter', 'CREATE', {}, 'ENCOUNTER_CREATED'],
    ['Encounter', 'READ', { scope: 'ENCOUNTER_RECORD' }, 'ENCOUNTER_RECORD_VIEWED'],
    ['Encounter', 'READ', { scope: 'TIMELINE' }, 'ENCOUNTER_TIMELINE_VIEWED'],
    ['Encounter', 'UPDATE', { status: 'COMPLETADO' }, 'ENCOUNTER_COMPLETED'],
    ['Encounter', 'UPDATE', { status: 'EN_PROGRESO' }, 'ENCOUNTER_REOPENED'],
    ['Encounter', 'UPDATE', { status: 'CANCELADO' }, 'ENCOUNTER_CANCELLED'],
    ['Encounter', 'UPDATE', { reviewStatus: 'REVISADA_POR_MEDICO' }, 'ENCOUNTER_REVIEW_STATUS_UPDATED'],
    ['Attachment', 'READ', {}, 'ATTACHMENT_LIST_VIEWED'],
    ['Attachment', 'DOWNLOAD', {}, 'ATTACHMENT_DOWNLOADED'],
    ['ClinicalAlert', 'READ', {}, 'ALERT_LIST_VIEWED'],
    ['InformedConsent', 'READ', {}, 'CONSENT_LIST_VIEWED'],
    ['UserInvitation', 'UPDATE', { revoked: true }, 'USER_INVITATION_REVOKED'],
    ['UserInvitation', 'DELETE', {}, 'USER_INVITATION_REVOKED'],
    ['User', 'PASSWORD_CHANGED', { reset: true }, 'USER_PASSWORD_RESET'],
    ['MedicationCatalog', 'UPDATE', { scope: 'CSV_IMPORT' }, 'MEDICATION_CSV_IMPORTED'],
    ['ClinicalAnalyticsSummary', 'READ', {}, 'CLINICAL_ANALYTICS_SUMMARY_VIEWED'],
    ['ClinicalAnalyticsCases', 'READ', {}, 'CLINICAL_ANALYTICS_CASES_VIEWED'],
    ['ClinicalAnalyticsCasesExport', 'EXPORT', { export: { format: 'csv' } }, 'CLINICAL_ANALYTICS_CSV_EXPORTED'],
    ['ClinicalAnalyticsSummaryExport', 'EXPORT', { export: { format: 'csv' } }, 'CLINICAL_ANALYTICS_SUMMARY_CSV_EXPORTED'],
    ['ClinicalAnalyticsSummaryReportExport', 'EXPORT', { export: { format: 'md' } }, 'CLINICAL_ANALYTICS_SUMMARY_REPORT_EXPORTED'],
    ['Setting', 'UPDATE', {}, 'SETTINGS_UPDATED'],
  ])('maps %s/%s to %s', (entityType, action, diff, expected) => {
    expect(inferAuditReason(entityType as any, action as any, diff)).toBe(expected);
  });

  it('marks login failures as rejected', () => {
    expect(inferAuditResult('LOGIN_FAILED' as any)).toBe('REJECTED');
  });

  it('marks successful actions as success by default', () => {
    expect(inferAuditResult('UPDATE' as any)).toBe('SUCCESS');
  });

  it('falls back to AUDIT_UNSPECIFIED for uncataloged combinations', () => {
    expect(inferAuditReason('UnknownEntity', 'UPDATE' as any, {})).toBe('AUDIT_UNSPECIFIED');
  });
});
