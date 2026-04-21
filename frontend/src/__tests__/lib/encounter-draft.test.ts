import {
  clearEncounterLocalStateForUser,
  clearEncounterSectionConflict,
  clearEncounterDraft,
  hasEncounterDraftUnsavedChanges,
  listEncounterSectionConflicts,
  readEncounterSectionConflict,
  readEncounterDraft,
  writeEncounterSectionConflict,
  writeEncounterDraft,
} from '@/lib/encounter-draft';
import { usePrivacySettingsStore } from '@/stores/privacy-settings-store';

describe('encounter draft helpers', () => {
  const encounterId = 'enc-1';
  const userId = 'user-1';

  beforeEach(() => {
    usePrivacySettingsStore.setState({ sharedDeviceMode: false, hasHydrated: true });
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

  it('lists recoverable conflict copies sorted by most recent first', () => {
    const olderSavedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const newerSavedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'ANAMNESIS_PROXIMA',
      localData: { relatoAmpliado: 'síntomas nuevos' },
      serverData: { relatoAmpliado: 'sin cambios' },
    });
    writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { texto: 'cefalea intensa' },
      serverData: { texto: 'cefalea leve' },
    });

    window.localStorage.setItem(
      'anamneo:encounter-conflict:v2:user-1:enc-1:ANAMNESIS_PROXIMA',
      JSON.stringify({
        version: 2,
        encounterId,
        userId,
        sectionKey: 'ANAMNESIS_PROXIMA',
        localData: { relatoAmpliado: 'síntomas nuevos' },
        serverData: { relatoAmpliado: 'sin cambios' },
        savedAt: olderSavedAt,
      }),
    );
    window.localStorage.setItem(
      'anamneo:encounter-conflict:v2:user-1:enc-1:MOTIVO_CONSULTA',
      JSON.stringify({
        version: 2,
        encounterId,
        userId,
        sectionKey: 'MOTIVO_CONSULTA',
        localData: { texto: 'cefalea intensa' },
        serverData: { texto: 'cefalea leve' },
        savedAt: newerSavedAt,
      }),
    );

    expect(listEncounterSectionConflicts(encounterId, userId).map((item) => item.sectionKey)).toEqual([
      'MOTIVO_CONSULTA',
      'ANAMNESIS_PROXIMA',
    ]);
  });

  it('clears all persisted encounter drafts and conflicts for a user on logout', () => {
    writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 1,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: {},
    });
    writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { texto: 'cefalea severa' },
      serverData: { texto: 'cefalea' },
    });
    writeEncounterDraft({
      version: 2,
      encounterId,
      userId: 'user-2',
      currentSectionIndex: 0,
      formData: {},
      savedSnapshot: {},
    });

    clearEncounterLocalStateForUser(userId);

    expect(readEncounterDraft(encounterId, userId)).toBeNull();
    expect(readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA')).toBeNull();
    expect(readEncounterDraft(encounterId, 'user-2')).not.toBeNull();
  });

  it('does not persist drafts or conflicts when shared-device mode is enabled', () => {
    usePrivacySettingsStore.setState({ sharedDeviceMode: true, hasHydrated: true });

    writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 1,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: {},
    });
    writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { texto: 'cefalea intensa' },
      serverData: { texto: 'cefalea leve' },
    });

    expect(readEncounterDraft(encounterId, userId)).toBeNull();
    expect(readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA')).toBeNull();
    expect(listEncounterSectionConflicts(encounterId, userId)).toEqual([]);
    expect(Object.keys(window.localStorage)).toEqual(['anamneo-privacy-settings']);
  });
});
