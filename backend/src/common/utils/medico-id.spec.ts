import * as fs from 'fs';
import * as path from 'path';
import { getEffectiveMedicoId } from './medico-id';

const permissionContract = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../../shared/permission-contract.json'), 'utf8'),
) as Array<{
  id: string;
  user: {
    id: string;
    role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
    isAdmin?: boolean;
    medicoId?: string | null;
  };
  expectations: {
    canEditAntecedentes: boolean;
  };
}>;

describe('medico-id permission contract', () => {
  it.each(permissionContract)('matches backend access contract for $id', ({ user, expectations }) => {
    if (expectations.canEditAntecedentes) {
      expect(getEffectiveMedicoId(user)).toBe(user.role === 'ASISTENTE' ? user.medicoId : user.id);
      return;
    }

    expect(() => getEffectiveMedicoId(user)).toThrow();
  });
});
