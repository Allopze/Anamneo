import {
  clearEncounterDraft,
  hasEncounterDraftUnsavedChanges,
  readEncounterDraft,
  writeEncounterDraft,
} from '@/lib/encounter-draft';

describe('encounter draft helpers', () => {
  const encounterId = 'enc-1';
  const userId = 'user-1';

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and restores encounter drafts from localStorage', () => {
    writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 2,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: { MOTIVO_CONSULTA: { texto: '' } },
    });

    const draft = readEncounterDraft(encounterId, userId);
    expect(draft).toMatchObject({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 2,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: { MOTIVO_CONSULTA: { texto: '' } },
    });
    expect(draft?.savedAt).toBeDefined();
  });

  it('clears persisted drafts', () => {
    writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 0,
      formData: {},
      savedSnapshot: {},
    });

    clearEncounterDraft(encounterId, userId);
    expect(readEncounterDraft(encounterId, userId)).toBeNull();
  });

  it('detects unsaved changes by comparing formData against savedSnapshot', () => {
    expect(hasEncounterDraftUnsavedChanges({
      formData: { IDENTIFICACION: { nombre: 'Paciente Demo' } },
      savedSnapshot: { IDENTIFICACION: { nombre: '' } },
    })).toBe(true);

    expect(hasEncounterDraftUnsavedChanges({
      formData: { IDENTIFICACION: { nombre: 'Paciente Demo' } },
      savedSnapshot: { IDENTIFICACION: { nombre: 'Paciente Demo' } },
    })).toBe(false);
  });
});
