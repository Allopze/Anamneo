import {
  buildRequiredWorkflowNoteError,
  hasRequiredWorkflowNote,
  normalizeClosureNoteForCompletion,
  normalizeReviewNoteForWorkflow,
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

  it('normalizes review notes before workflow mutations', () => {
    expect(normalizeReviewNoteForWorkflow('  Revisión final suficiente.  ')).toBe('Revisión final suficiente.');
  });

  it('validates required workflow notes using the shared minimum length', () => {
    expect(hasRequiredWorkflowNote('corta')).toBe(false);
    expect(hasRequiredWorkflowNote('Nota clínica suficiente.')).toBe(true);
  });

  it('builds the same validation message expected from workflow actions', () => {
    expect(buildRequiredWorkflowNoteError('La nota de cierre')).toBe('La nota de cierre debe tener al menos 10 caracteres');
  });
});