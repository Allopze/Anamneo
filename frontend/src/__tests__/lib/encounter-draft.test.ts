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
    window.sessionStorage.clear();
  });

  it('persists and restores encounter drafts from sessionStorage', () => {
    writeEncounterDraft({
      version: 1,
      encounterId,
      userId,
      currentSectionIndex: 2,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: { MOTIVO_CONSULTA: { texto: '' } },
    });

    expect(readEncounterDraft(encounterId, userId)).toEqual({
      version: 1,
      encounterId,
      userId,
      currentSectionIndex: 2,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: { MOTIVO_CONSULTA: { texto: '' } },
    });
  });

  it('clears persisted drafts', () => {
    writeEncounterDraft({
      version: 1,
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
