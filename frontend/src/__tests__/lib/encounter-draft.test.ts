import {
  clearEncounterSectionConflict,
  clearEncounterDraft,
  hasEncounterDraftUnsavedChanges,
  readEncounterSectionConflict,
  readEncounterDraft,
  writeEncounterSectionConflict,
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

  it('persists and restores a recoverable conflict copy per section', () => {
    writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { subjetivo: 'Dolor retroesternal' },
      serverData: { subjetivo: 'Control sin dolor' },
      serverUpdatedAt: '2026-04-19T10:00:00.000Z',
    });

    const conflict = readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA');
    expect(conflict).toMatchObject({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { subjetivo: 'Dolor retroesternal' },
      serverData: { subjetivo: 'Control sin dolor' },
      serverUpdatedAt: '2026-04-19T10:00:00.000Z',
    });
    expect(conflict?.savedAt).toBeDefined();
  });

  it('clears a recoverable conflict copy without affecting the main draft', () => {
    writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 0,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: { MOTIVO_CONSULTA: { texto: '' } },
    });
    writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { texto: 'cefalea intensa' },
      serverData: { texto: 'cefalea' },
    });

    clearEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA');

    expect(readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA')).toBeNull();
    expect(readEncounterDraft(encounterId, userId)).not.toBeNull();
  });
});
