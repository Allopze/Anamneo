import { canUseEncounterAsDuplicateSource, getDuplicateEncounterActionLabel } from '@/lib/encounter-duplicate';

describe('encounter duplicate helpers', () => {
  it('only allows completed or signed encounters as follow-up sources', () => {
    expect(canUseEncounterAsDuplicateSource('COMPLETADO')).toBe(true);
    expect(canUseEncounterAsDuplicateSource('FIRMADO')).toBe(true);
    expect(canUseEncounterAsDuplicateSource('EN_PROGRESO')).toBe(false);
    expect(canUseEncounterAsDuplicateSource('CANCELADO')).toBe(false);
  });

  it('returns labels that match the clean follow-up flow', () => {
    expect(getDuplicateEncounterActionLabel(false)).toBe('Nuevo seguimiento');
    expect(getDuplicateEncounterActionLabel(true)).toBe('Preparando seguimiento…');
  });
});