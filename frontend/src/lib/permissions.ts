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

export function canCreatePatient(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
}

export function canCreateEncounter(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
}

export function canEditPatientAdmin(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
}

export function canUploadAttachments(
  user: PermissionUser | null | undefined,
  encounter?: Pick<Encounter, 'status'> | null,
) {
  if (encounter && encounter.status !== 'EN_PROGRESO') {
    return false;
  }

  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
}

export function canImportConditionsCsv(user: PermissionUser | null | undefined) {
  return Boolean(user?.role === 'ADMIN');
}

export function canEditAntecedentes(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
}

export function canCreatePatientTask(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
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
