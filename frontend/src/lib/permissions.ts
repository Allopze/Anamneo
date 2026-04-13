import { Encounter } from '@/types';

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

export function canUploadAttachments(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
}

export function canImportConditionsCsv(user: PermissionUser | null | undefined) {
  return Boolean(user?.role === 'ADMIN');
}

export function canEditAntecedentes(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user) || hasAssignedMedico(user));
}

export function canViewMedicoOnlySections(user: PermissionUser | null | undefined) {
  return Boolean(isMedicoUser(user));
}

export function canEditEncounter(
  user: PermissionUser | null | undefined,
  encounter: Encounter | undefined,
) {
  if (!user || !encounter || encounter.status !== 'EN_PROGRESO') {
    return false;
  }

  return isMedicoUser(user) || encounter.createdBy?.id === user.id;
}

export function canCompleteEncounter(
  user: PermissionUser | null | undefined,
  encounter: Encounter | undefined,
) {
  return Boolean(
    user &&
    encounter?.status === 'EN_PROGRESO' &&
    isMedicoUser(user) &&
    encounter?.createdBy?.id === user.id,
  );
}
