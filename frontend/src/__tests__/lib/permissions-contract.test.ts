import permissionContract from '../../../../shared/permission-contract.json';
import {
  canCreateEncounter,
  canEditAntecedentes,
  canEditPatientAdmin,
  PermissionUser,
} from '@/lib/permissions';

describe('permission contract', () => {
  it.each(permissionContract)('matches frontend permission helpers for $id', ({ user, expectations }) => {
    const permissionUser = user as PermissionUser;

    expect(canEditAntecedentes(permissionUser)).toBe(expectations.canEditAntecedentes);
    expect(canEditPatientAdmin(permissionUser)).toBe(expectations.canEditPatientAdmin);
    expect(canCreateEncounter(permissionUser)).toBe(expectations.canCreateEncounter);
  });
});
