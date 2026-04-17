import { MEDICO_ONLY_SECTION_KEYS } from './encounter-section-policy';

export type EncounterPermissionRole = 'MEDICO' | 'ASISTENTE' | 'ADMIN';
export type EncounterReviewStatus = 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO';
export type EncounterStatus = 'EN_PROGRESO' | 'COMPLETADO' | 'FIRMADO' | 'CANCELADO';

type EncounterRolePolicy = {
  canViewMedicoOnlySections: boolean;
  canEditEncounterCreatedByAnyUser: boolean;
  canCompleteInProgressEncounter: boolean;
  canSignCompletedEncounter: boolean;
  canReopenCompletedEncounter: boolean;
  canCancelInProgressEncounter: boolean;
  canExportClinicalDocuments: boolean;
  canPrintClinicalRecord: boolean;
  canViewAuditHistory: boolean;
  allowedReviewStatuses: EncounterReviewStatus[];
};

export const ENCOUNTER_PERMISSION_CONTRACT: Record<EncounterPermissionRole, EncounterRolePolicy> = {
  MEDICO: {
    canViewMedicoOnlySections: true,
    canEditEncounterCreatedByAnyUser: true,
    canCompleteInProgressEncounter: true,
    canSignCompletedEncounter: true,
    canReopenCompletedEncounter: true,
    canCancelInProgressEncounter: true,
    canExportClinicalDocuments: true,
    canPrintClinicalRecord: true,
    canViewAuditHistory: true,
    allowedReviewStatuses: ['NO_REQUIERE_REVISION', 'REVISADA_POR_MEDICO'],
  },
  ASISTENTE: {
    canViewMedicoOnlySections: false,
    canEditEncounterCreatedByAnyUser: false,
    canCompleteInProgressEncounter: false,
    canSignCompletedEncounter: false,
    canReopenCompletedEncounter: false,
    canCancelInProgressEncounter: false,
    canExportClinicalDocuments: true,
    canPrintClinicalRecord: true,
    canViewAuditHistory: true,
    allowedReviewStatuses: ['LISTA_PARA_REVISION'],
  },
  ADMIN: {
    canViewMedicoOnlySections: false,
    canEditEncounterCreatedByAnyUser: false,
    canCompleteInProgressEncounter: false,
    canSignCompletedEncounter: false,
    canReopenCompletedEncounter: false,
    canCancelInProgressEncounter: false,
    canExportClinicalDocuments: false,
    canPrintClinicalRecord: false,
    canViewAuditHistory: false,
    allowedReviewStatuses: [],
  },
};

const ENCOUNTER_ROLE_SET = new Set<EncounterPermissionRole>(Object.keys(ENCOUNTER_PERMISSION_CONTRACT) as EncounterPermissionRole[]);
const MEDICO_ONLY_SECTION_SET = new Set<string>(MEDICO_ONLY_SECTION_KEYS);

function getEncounterRolePolicy(role: string | null | undefined) {
  if (!role || !ENCOUNTER_ROLE_SET.has(role as EncounterPermissionRole)) {
    return null;
  }

  return ENCOUNTER_PERMISSION_CONTRACT[role as EncounterPermissionRole];
}

export function isMedicoOnlyEncounterSection(sectionKey: string | null | undefined) {
  return Boolean(sectionKey && MEDICO_ONLY_SECTION_SET.has(sectionKey));
}

export function canRoleViewEncounterSection(role: string | null | undefined, sectionKey: string | null | undefined) {
  const policy = getEncounterRolePolicy(role);

  if (!policy || !sectionKey) {
    return false;
  }

  if (isMedicoOnlyEncounterSection(sectionKey)) {
    return policy.canViewMedicoOnlySections;
  }

  return role === 'MEDICO' || role === 'ASISTENTE';
}

export function canRoleEditEncounterRecord(
  role: string | null | undefined,
  userId: string | null | undefined,
  createdById: string | null | undefined,
) {
  const policy = getEncounterRolePolicy(role);

  if (!policy) {
    return false;
  }

  return policy.canEditEncounterCreatedByAnyUser || Boolean(userId && createdById && userId === createdById);
}

export function canRoleCompleteEncounter(role: string | null | undefined, status: EncounterStatus | null | undefined) {
  const policy = getEncounterRolePolicy(role);
  return Boolean(policy?.canCompleteInProgressEncounter && status === 'EN_PROGRESO');
}

export function canRoleSignEncounter(role: string | null | undefined, status: EncounterStatus | null | undefined) {
  const policy = getEncounterRolePolicy(role);
  return Boolean(policy?.canSignCompletedEncounter && status === 'COMPLETADO');
}

export function canRoleReopenEncounter(role: string | null | undefined, status: EncounterStatus | null | undefined) {
  const policy = getEncounterRolePolicy(role);
  return Boolean(policy?.canReopenCompletedEncounter && status === 'COMPLETADO');
}

export function canRoleCancelEncounter(role: string | null | undefined, status: EncounterStatus | null | undefined) {
  const policy = getEncounterRolePolicy(role);
  return Boolean(policy?.canCancelInProgressEncounter && status === 'EN_PROGRESO');
}

export function canRoleExportEncounterDocuments(role: string | null | undefined) {
  return Boolean(getEncounterRolePolicy(role)?.canExportClinicalDocuments);
}

export function canRolePrintEncounterRecord(role: string | null | undefined) {
  return Boolean(getEncounterRolePolicy(role)?.canPrintClinicalRecord);
}

export function canRoleViewEncounterAudit(role: string | null | undefined) {
  return Boolean(getEncounterRolePolicy(role)?.canViewAuditHistory);
}

export function canRoleUpdateEncounterReviewStatus(
  role: string | null | undefined,
  reviewStatus: EncounterReviewStatus,
) {
  const policy = getEncounterRolePolicy(role);
  return Boolean(policy && policy.allowedReviewStatuses.includes(reviewStatus));
}
