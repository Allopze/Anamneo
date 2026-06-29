import { Encounter } from '@/types';
import {
  ENCOUNTER_PERMISSION_CONTRACT,
  canRoleCancelEncounter,
  canRoleCompleteEncounter,
  canRoleEditEncounterRecord,
  canRoleExportEncounterDocuments,
  canRolePrintEncounterRecord,
  canRoleReopenEncounter,
  canRoleSignEncounter,
  canRoleUpdateEncounterReviewStatus,
  canRoleViewEncounterAudit,
  canRoleViewEncounterSection,
} from '../../../shared/encounter-permission-contract';
import {
  roleHasFineGrainedAction,
  type FineGrainedAction,
} from '../../../shared/fine-grained-permission-contract';

export interface PermissionUser {
  id: string;
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
  isAdmin?: boolean;
  medicoId?: string | null;
}

export function isMedicoUser(user: PermissionUser | null | undefined) {
  return user?.role === 'MEDICO';
}

export function isAssistantUser(user: PermissionUser | null | undefined) {
  return user?.role === 'ASISTENTE';
}

export function isAdminUser(user: PermissionUser | null | undefined) {
  return user?.role === 'ADMIN' || user?.isAdmin === true;
}

export function hasAssignedMedico(user: PermissionUser | null | undefined) {
  return Boolean(user && isAssistantUser(user) && user.medicoId);
}

/**
 * Whether the user can read clinical alerts. Mirrors the backend
 * `@Roles('MEDICO', 'ASISTENTE')` guard on `/alerts/*`; operational admins
 * (role ADMIN) get 403, so they must not trigger the alert queries.
 */
export function canViewClinicalAlerts(user: PermissionUser | null | undefined) {
  return user?.role === 'MEDICO' || user?.role === 'ASISTENTE';
}

/**
 * Whether the user can read operational reports. Mirrors the backend
 * `@Roles('MEDICO', 'ASISTENTE')` guard on `/analytics/operational/*`;
 * operational admins (role ADMIN) get 403.
 */
export function canViewOperationalReports(user: PermissionUser | null | undefined) {
  return user?.role === 'MEDICO' || user?.role === 'ASISTENTE';
}

export function canCreatePatient(user: PermissionUser | null | undefined) {
  return Boolean(
    canPerformFineGrainedAction(user, 'patient.create')
    && (!isAssistantUser(user) || hasAssignedMedico(user)),
  );
}

export function canCreateEncounter(user: PermissionUser | null | undefined) {
  return Boolean(
    canPerformFineGrainedAction(user, 'encounter.create')
    && (!isAssistantUser(user) || hasAssignedMedico(user)),
  );
}

export function canEditPatientAdmin(user: PermissionUser | null | undefined) {
  return Boolean(
    canPerformFineGrainedAction(user, 'patient.editAdministrative')
    && (!isAssistantUser(user) || hasAssignedMedico(user)),
  );
}

export function canUploadAttachments(
  user: PermissionUser | null | undefined,
  encounter?: Pick<Encounter, 'status'> | null,
) {
  if (encounter && encounter.status !== 'EN_PROGRESO') {
    return false;
  }

  return Boolean(
    canPerformFineGrainedAction(user, 'attachment.upload')
    && (!isAssistantUser(user) || hasAssignedMedico(user)),
  );
}

export function canImportConditionsCsv(user: PermissionUser | null | undefined) {
  return Boolean(user?.role === 'ADMIN');
}

export function canImportMedicationsCsv(user: PermissionUser | null | undefined) {
  return Boolean(user?.role === 'ADMIN');
}

export function canPerformFineGrainedAction(
  user: PermissionUser | null | undefined,
  action: FineGrainedAction,
) {
  return roleHasFineGrainedAction(user?.role, action);
}

export function canReassignPatient(user: PermissionUser | null | undefined) {
  return canPerformFineGrainedAction(user, 'patient.reassign');
}

export function canReassignEncounter(user: PermissionUser | null | undefined) {
  return canPerformFineGrainedAction(user, 'encounter.reassign');
}

export function canRunAdminMaintenance(user: PermissionUser | null | undefined) {
  return canPerformFineGrainedAction(user, 'admin.maintenance');
}

export function canManageSettings(user: PermissionUser | null | undefined) {
  return canPerformFineGrainedAction(user, 'settings.manage');
}

export function canEditAntecedentes(user: PermissionUser | null | undefined) {
  return Boolean(
    canPerformFineGrainedAction(user, 'patient.editClinical')
    || (canPerformFineGrainedAction(user, 'patient.editAdministrative') && hasAssignedMedico(user)),
  );
}

export function canCreatePatientTask(user: PermissionUser | null | undefined) {
  return Boolean(
    canPerformFineGrainedAction(user, 'patientTask.manage')
    && (!isAssistantUser(user) || hasAssignedMedico(user)),
  );
}

export function canRegisterClinicalConsent(user: PermissionUser | null | undefined) {
  return Boolean(
    canPerformFineGrainedAction(user, 'clinicalConsent.create')
    && (!isAssistantUser(user) || hasAssignedMedico(user)),
  );
}

export function canRevokeClinicalConsent(user: PermissionUser | null | undefined) {
  return canPerformFineGrainedAction(user, 'clinicalConsent.revoke');
}

export function canViewMedicoOnlySections(user: PermissionUser | null | undefined) {
  return Boolean(user && ENCOUNTER_PERMISSION_CONTRACT[user.role]?.canViewMedicoOnlySections);
}

export function canViewEncounterSection(
  user: PermissionUser | null | undefined,
  sectionKey: string | null | undefined,
) {
  return canRoleViewEncounterSection(user?.role, sectionKey);
}

export function canUpdateEncounterReviewStatus(
  user: PermissionUser | null | undefined,
  reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO',
) {
  return canRoleUpdateEncounterReviewStatus(user?.role, reviewStatus);
}

export function canEditEncounter(
  user: PermissionUser | null | undefined,
  encounter: Encounter | undefined,
) {
  if (!user || !encounter || encounter.status !== 'EN_PROGRESO') {
    return false;
  }

  return canRoleEditEncounterRecord(user.role, user.id, encounter.createdBy?.id ?? encounter.createdById);
}

export function canCompleteEncounter(
  user: PermissionUser | null | undefined,
  encounter: Encounter | undefined,
) {
  return canRoleCompleteEncounter(user?.role, encounter?.status);
}

export function canSignEncounter(
  user: PermissionUser | null | undefined,
  encounter: Encounter | undefined,
) {
  return canRoleSignEncounter(user?.role, encounter?.status);
}

export function canReopenEncounter(
  user: PermissionUser | null | undefined,
  encounter: Encounter | undefined,
) {
  return canRoleReopenEncounter(user?.role, encounter?.status);
}

export function canCancelEncounter(
  user: PermissionUser | null | undefined,
  encounter: Encounter | undefined,
) {
  return canRoleCancelEncounter(user?.role, encounter?.status);
}

export function canExportEncounterDocuments(user: PermissionUser | null | undefined) {
  return canRoleExportEncounterDocuments(user?.role);
}

export function canPrintEncounterRecord(user: PermissionUser | null | undefined) {
  return canRolePrintEncounterRecord(user?.role);
}

export function canViewEncounterAudit(user: PermissionUser | null | undefined) {
  return canRoleViewEncounterAudit(user?.role);
}
