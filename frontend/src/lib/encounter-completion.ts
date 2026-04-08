export const CLOSURE_NOTE_MIN_LENGTH = 15;

export function normalizeClosureNoteForCompletion(closureNote: string): string {
  return closureNote.trim();
}

export function getClosureNoteCompletionError(closureNote: string): string | null {
  const trimmedClosureNote = normalizeClosureNoteForCompletion(closureNote);

  if (trimmedClosureNote.length < CLOSURE_NOTE_MIN_LENGTH) {
    return `La nota de cierre debe tener al menos ${CLOSURE_NOTE_MIN_LENGTH} caracteres`;
  }

  return null;
}