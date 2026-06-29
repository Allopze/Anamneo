import { canApplyReviewStatus, canEditEncounterCreatedBy } from './encounter-policy';

describe('encounter-policy', () => {
  const medico = { id: 'med-1', role: 'MEDICO' } as const;
  const assistant = { id: 'assistant-1', role: 'ASISTENTE', medicoId: 'med-1' } as const;
  const admin = { id: 'admin-1', role: 'ADMIN', isAdmin: true } as const;

  it('allows doctors to edit encounters regardless of creator and assistants only their own', () => {
    expect(canEditEncounterCreatedBy(medico, 'assistant-1')).toBe(true);
    expect(canEditEncounterCreatedBy(assistant, 'assistant-1')).toBe(true);
    expect(canEditEncounterCreatedBy(assistant, 'assistant-2')).toBe(false);
    expect(canEditEncounterCreatedBy(admin, 'assistant-1')).toBe(false);
  });

  it('applies review status transitions from the shared encounter contract', () => {
    expect(canApplyReviewStatus(medico, 'REVISADA_POR_MEDICO')).toBe(true);
    expect(canApplyReviewStatus(medico, 'NO_REQUIERE_REVISION')).toBe(true);
    expect(canApplyReviewStatus(medico, 'LISTA_PARA_REVISION')).toBe(false);
    expect(canApplyReviewStatus(assistant, 'LISTA_PARA_REVISION')).toBe(true);
    expect(canApplyReviewStatus(assistant, 'REVISADA_POR_MEDICO')).toBe(false);
    expect(canApplyReviewStatus(admin, 'NO_REQUIERE_REVISION')).toBe(false);
  });
});
