import {
  normalizeClosureNoteForCompletion,
} from '@/lib/encounter-completion';

describe('encounter completion helpers', () => {
  it('normalizes the closure note before sending it to the API', () => {
    expect(normalizeClosureNoteForCompletion('  Cierre clínico suficiente.  ')).toBe(
      'Cierre clínico suficiente.',
    );
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeClosureNoteForCompletion('   ')).toBe('');
  });
});