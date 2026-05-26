export type PermissionRole = 'MEDICO' | 'ASISTENTE' | 'ADMIN';

export type FineGrainedAction =
  | 'patient.read'
  | 'patient.create'
  | 'patient.editClinical'
  | 'patient.editAdministrative'
  | 'patient.reassign'
  | 'patient.archive'
  | 'patient.restore'
  | 'encounter.create'
  | 'encounter.read'
  | 'encounter.edit'
  | 'encounter.reassign'
  | 'encounter.complete'
  | 'encounter.sign'
  | 'encounter.reopen'
  | 'encounter.cancel'
  | 'encounter.updateReview'
  | 'encounter.viewAudit'
  | 'attachment.upload'
  | 'attachment.delete'
  | 'clinicalConsent.create'
  | 'clinicalConsent.revoke'
  | 'patientTask.manage'
  | 'patientProblem.manage'
  | 'export.clinical'
  | 'export.operational'
  | 'admin.maintenance'
  | 'settings.manage';

export const FINE_GRAINED_PERMISSION_CONTRACT: Record<PermissionRole, FineGrainedAction[]> = {
  MEDICO: [
    'patient.read',
    'patient.create',
    'patient.editClinical',
    'patient.editAdministrative',
    'patient.reassign',
    'patient.archive',
    'patient.restore',
    'encounter.create',
    'encounter.read',
    'encounter.edit',
    'encounter.reassign',
    'encounter.complete',
    'encounter.sign',
    'encounter.reopen',
    'encounter.cancel',
    'encounter.updateReview',
    'encounter.viewAudit',
    'attachment.upload',
    'attachment.delete',
    'clinicalConsent.create',
    'clinicalConsent.revoke',
    'patientTask.manage',
    'patientProblem.manage',
    'export.clinical',
  ],
  ASISTENTE: [
    'patient.read',
    'patient.create',
    'patient.editAdministrative',
    'encounter.create',
    'encounter.read',
    'encounter.edit',
    'encounter.updateReview',
    'encounter.viewAudit',
    'attachment.upload',
    'attachment.delete',
    'clinicalConsent.create',
    'patientTask.manage',
    'patientProblem.manage',
    'export.clinical',
  ],
  ADMIN: [
    'patient.reassign',
    'encounter.reassign',
    'export.operational',
    'admin.maintenance',
    'settings.manage',
  ],
};

export function roleHasFineGrainedAction(role: string | null | undefined, action: FineGrainedAction) {
  if (!role || !(role in FINE_GRAINED_PERMISSION_CONTRACT)) {
    return false;
  }
  return FINE_GRAINED_PERMISSION_CONTRACT[role as PermissionRole].includes(action);
}
