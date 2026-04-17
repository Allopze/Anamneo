export type PermissionContractRole = 'MEDICO' | 'ASISTENTE' | 'ADMIN';

export interface PermissionContractUser {
  id: string;
  role: PermissionContractRole;
  isAdmin?: boolean;
  medicoId?: string | null;
}

export interface PermissionContractExpectations {
  canEditAntecedentes: boolean;
  canEditPatientAdmin: boolean;
  canCreateEncounter: boolean;
  canViewMedicoOnlySections: boolean;
  canUpdateReviewStatus: boolean;
}

export interface PermissionContractScenario {
  id: string;
  user: PermissionContractUser;
  expectations: PermissionContractExpectations;
}

export const PERMISSION_CONTRACT_SCENARIOS: PermissionContractScenario[] = [
  {
    id: 'medico',
    user: {
      id: 'med-1',
      role: 'MEDICO',
    },
    expectations: {
      canEditAntecedentes: true,
      canEditPatientAdmin: true,
      canCreateEncounter: true,
      canViewMedicoOnlySections: true,
      canUpdateReviewStatus: true,
    },
  },
  {
    id: 'admin',
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      isAdmin: true,
    },
    expectations: {
      canEditAntecedentes: false,
      canEditPatientAdmin: false,
      canCreateEncounter: false,
      canViewMedicoOnlySections: false,
      canUpdateReviewStatus: false,
    },
  },
  {
    id: 'assistant_assigned',
    user: {
      id: 'assistant-1',
      role: 'ASISTENTE',
      medicoId: 'med-1',
    },
    expectations: {
      canEditAntecedentes: true,
      canEditPatientAdmin: true,
      canCreateEncounter: true,
      canViewMedicoOnlySections: false,
      canUpdateReviewStatus: false,
    },
  },
  {
    id: 'assistant_unassigned',
    user: {
      id: 'assistant-2',
      role: 'ASISTENTE',
      medicoId: null,
    },
    expectations: {
      canEditAntecedentes: false,
      canEditPatientAdmin: false,
      canCreateEncounter: false,
      canViewMedicoOnlySections: false,
      canUpdateReviewStatus: false,
    },
  },
];
