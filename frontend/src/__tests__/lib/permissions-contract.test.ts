import { PERMISSION_CONTRACT_SCENARIOS } from '../../../../shared/permission-contract';
import {
  canCreateEncounter,
  canEditAntecedentes,
  canEditPatientAdmin,
  canUpdateEncounterReviewStatus,
  canViewMedicoOnlySections,
  PermissionUser,
} from '@/lib/permissions';

describe('permission contract', () => {
  it.each(PERMISSION_CONTRACT_SCENARIOS)('matches frontend permission helpers for $id', ({ user, expectations }) => {
    const permissionUser = user as PermissionUser;

    expect(canEditAntecedentes(permissionUser)).toBe(expectations.canEditAntecedentes);
    expect(canEditPatientAdmin(permissionUser)).toBe(expectations.canEditPatientAdmin);
    expect(canCreateEncounter(permissionUser)).toBe(expectations.canCreateEncounter);
    expect(canViewMedicoOnlySections(permissionUser)).toBe(expectations.canViewMedicoOnlySections);
    expect(canUpdateEncounterReviewStatus(permissionUser, 'REVISADA_POR_MEDICO')).toBe(expectations.canUpdateReviewStatus);
  });
});
