import { inferAuditReason, inferAuditResult } from './audit-catalog';

describe('audit-catalog', () => {
  it.each([
    ['Patient', 'CREATE', {}, 'PATIENT_CREATED'],
    ['PatientHistory', 'CREATE', {}, 'PATIENT_HISTORY_CREATED'],
    ['Patient', 'UPDATE', { archivedAt: '2026-03-31T12:00:00.000Z' }, 'PATIENT_ARCHIVED'],
    ['Patient', 'UPDATE', { restoredAt: '2026-03-31T12:00:00.000Z' }, 'PATIENT_RESTORED'],
    ['Patient', 'UPDATE', { scope: 'ADMIN_FIELDS' }, 'PATIENT_ADMIN_UPDATED'],
    ['Encounter', 'CREATE', {}, 'ENCOUNTER_CREATED'],
    ['Encounter', 'UPDATE', { status: 'COMPLETADO' }, 'ENCOUNTER_COMPLETED'],
    ['Encounter', 'UPDATE', { status: 'EN_PROGRESO' }, 'ENCOUNTER_REOPENED'],
    ['Encounter', 'UPDATE', { status: 'CANCELADO' }, 'ENCOUNTER_CANCELLED'],
    ['Encounter', 'UPDATE', { reviewStatus: 'REVISADA_POR_MEDICO' }, 'ENCOUNTER_REVIEW_STATUS_UPDATED'],
    ['Attachment', 'DOWNLOAD', {}, 'ATTACHMENT_DOWNLOADED'],
    ['UserInvitation', 'UPDATE', { revoked: true }, 'USER_INVITATION_REVOKED'],
    ['UserInvitation', 'DELETE', {}, 'USER_INVITATION_REVOKED'],
    ['User', 'PASSWORD_CHANGED', { reset: true }, 'USER_PASSWORD_RESET'],
    ['MedicationCatalog', 'UPDATE', { scope: 'CSV_IMPORT' }, 'MEDICATION_CSV_IMPORTED'],
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
