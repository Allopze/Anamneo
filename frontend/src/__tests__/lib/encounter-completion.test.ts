import {
  CLOSURE_NOTE_MIN_LENGTH,
  getClosureNoteCompletionError,
  normalizeClosureNoteForCompletion,
} from '@/lib/encounter-completion';

describe('encounter completion helpers', () => {
  it('normalizes the closure note before sending it to the API', () => {
    expect(normalizeClosureNoteForCompletion('  Cierre clínico suficiente.  ')).toBe(
      'Cierre clínico suficiente.',
    );
  });

  it.each([
    ['', `La nota de cierre debe tener al menos ${CLOSURE_NOTE_MIN_LENGTH} caracteres`],
    ['   ', `La nota de cierre debe tener al menos ${CLOSURE_NOTE_MIN_LENGTH} caracteres`],
    ['corta', `La nota de cierre debe tener al menos ${CLOSURE_NOTE_MIN_LENGTH} caracteres`],
  ])('rejects invalid closure note %p', (input, expectedError) => {
    expect(getClosureNoteCompletionError(input)).toBe(expectedError);
  });

  it('accepts a trimmed closure note with enough clinical content', () => {
    expect(
      getClosureNoteCompletionError('  Paciente con cierre informado y control indicado.  '),
    ).toBeNull();
  });
});