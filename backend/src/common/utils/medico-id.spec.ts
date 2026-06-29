import { getEffectiveMedicoId } from './medico-id';

describe('getEffectiveMedicoId', () => {
  it('returns the current user id for medico users', () => {
    expect(getEffectiveMedicoId({ id: 'med-1', role: 'MEDICO' })).toBe('med-1');
  });

  it('returns the current user id for admin users', () => {
    expect(getEffectiveMedicoId({ id: 'admin-1', role: 'ADMIN', isAdmin: true })).toBe('admin-1');
  });

  it('returns the assigned medico id for assistants with assignment', () => {
    expect(getEffectiveMedicoId({ id: 'assistant-1', role: 'ASISTENTE', medicoId: 'med-1' })).toBe('med-1');
  });

  it('throws for assistants without assigned medico', () => {
    expect(() => getEffectiveMedicoId({ id: 'assistant-2', role: 'ASISTENTE', medicoId: null })).toThrow();
  });
});
