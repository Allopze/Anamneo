import { isMedicoOnlySection, shouldHideEncounterSectionForRole } from './encounter-access-policy';

describe('encounter-access-policy', () => {
  it('recognizes medico-only sections from the shared contract', () => {
    expect(isMedicoOnlySection('TRATAMIENTO')).toBe(true);
    expect(isMedicoOnlySection('MOTIVO_CONSULTA')).toBe(false);
  });

  it('hides medico-only sections only for assistants', () => {
    expect(shouldHideEncounterSectionForRole('ASISTENTE', 'TRATAMIENTO')).toBe(true);
    expect(shouldHideEncounterSectionForRole('ASISTENTE', 'MOTIVO_CONSULTA')).toBe(false);
    expect(shouldHideEncounterSectionForRole('MEDICO', 'TRATAMIENTO')).toBe(false);
    expect(shouldHideEncounterSectionForRole(undefined, 'TRATAMIENTO')).toBe(false);
  });
});
