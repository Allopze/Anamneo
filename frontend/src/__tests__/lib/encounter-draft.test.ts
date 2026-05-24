import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';
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
import { encryptPhiJson } from '@/lib/local-phi-crypto';
import { usePrivacySettingsStore } from '@/stores/privacy-settings-store';

describe('encounter draft helpers', () => {
  const encounterId = 'enc-1';
  const userId = 'user-1';

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    Object.defineProperty(window, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'TextEncoder', {
      value: TextEncoder,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'TextDecoder', {
      value: TextDecoder,
      configurable: true,
    });
  });

  beforeEach(() => {
    usePrivacySettingsStore.setState({ sharedDeviceMode: false, hasHydrated: true });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('persists and restores encrypted encounter drafts from localStorage', async () => {
    await writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 2,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: { MOTIVO_CONSULTA: { texto: '' } },
    });

    const raw = window.localStorage.getItem('anamneo:encounter-draft:v2:user-1:enc-1');
    expect(raw).toEqual(expect.any(String));
    expect(raw).not.toContain('cefalea');

    const draft = await readEncounterDraft(encounterId, userId);
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

  it('clears persisted drafts', async () => {
    await writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 0,
      formData: {},
      savedSnapshot: {},
    });

    clearEncounterDraft(encounterId, userId);
    await expect(readEncounterDraft(encounterId, userId)).resolves.toBeNull();
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

  it('persists and restores an encrypted recoverable conflict copy per section', async () => {
    await writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { subjetivo: 'Dolor retroesternal' },
      serverData: { subjetivo: 'Control sin dolor' },
      serverUpdatedAt: '2026-04-19T10:00:00.000Z',
    });

    const raw = window.localStorage.getItem('anamneo:encounter-conflict:v2:user-1:enc-1:MOTIVO_CONSULTA');
    expect(raw).toEqual(expect.any(String));
    expect(raw).not.toContain('Dolor retroesternal');

    const conflict = await readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA');
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

  it('clears a recoverable conflict copy without affecting the main draft', async () => {
    await writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 0,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: { MOTIVO_CONSULTA: { texto: '' } },
    });
    await writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { texto: 'cefalea intensa' },
      serverData: { texto: 'cefalea' },
    });

    clearEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA');

    await expect(readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA')).resolves.toBeNull();
    await expect(readEncounterDraft(encounterId, userId)).resolves.not.toBeNull();
  });

  it('lists recoverable conflict copies sorted by most recent first', async () => {
    const olderSavedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const newerSavedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    window.localStorage.setItem(
      'anamneo:encounter-conflict:v2:user-1:enc-1:ANAMNESIS_PROXIMA',
      JSON.stringify(await encryptPhiJson({
        version: 2,
        encounterId,
        userId,
        sectionKey: 'ANAMNESIS_PROXIMA',
        localData: { relatoAmpliado: 'síntomas nuevos' },
        serverData: { relatoAmpliado: 'sin cambios' },
        savedAt: olderSavedAt,
      })),
    );
    window.localStorage.setItem(
      'anamneo:encounter-conflict:v2:user-1:enc-1:MOTIVO_CONSULTA',
      JSON.stringify(await encryptPhiJson({
        version: 2,
        encounterId,
        userId,
        sectionKey: 'MOTIVO_CONSULTA',
        localData: { texto: 'cefalea intensa' },
        serverData: { texto: 'cefalea leve' },
        savedAt: newerSavedAt,
      })),
    );

    expect((await listEncounterSectionConflicts(encounterId, userId)).map((item) => item.sectionKey)).toEqual([
      'MOTIVO_CONSULTA',
      'ANAMNESIS_PROXIMA',
    ]);
  });

  it('clears all persisted encounter drafts and conflicts for a user on logout', async () => {
    await writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 1,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: {},
    });
    await writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { texto: 'cefalea severa' },
      serverData: { texto: 'cefalea' },
    });
    await writeEncounterDraft({
      version: 2,
      encounterId,
      userId: 'user-2',
      currentSectionIndex: 0,
      formData: {},
      savedSnapshot: {},
    });

    clearEncounterLocalStateForUser(userId);

    await expect(readEncounterDraft(encounterId, userId)).resolves.toBeNull();
    await expect(readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA')).resolves.toBeNull();
    await expect(readEncounterDraft(encounterId, 'user-2')).resolves.not.toBeNull();
  });

  it('does not persist drafts or conflicts when shared-device mode is enabled', async () => {
    usePrivacySettingsStore.setState({ sharedDeviceMode: true, hasHydrated: true });

    await writeEncounterDraft({
      version: 2,
      encounterId,
      userId,
      currentSectionIndex: 1,
      formData: { MOTIVO_CONSULTA: { texto: 'cefalea' } },
      savedSnapshot: {},
    });
    await writeEncounterSectionConflict({
      version: 2,
      encounterId,
      userId,
      sectionKey: 'MOTIVO_CONSULTA',
      localData: { texto: 'cefalea intensa' },
      serverData: { texto: 'cefalea leve' },
    });

    await expect(readEncounterDraft(encounterId, userId)).resolves.toBeNull();
    await expect(readEncounterSectionConflict(encounterId, userId, 'MOTIVO_CONSULTA')).resolves.toBeNull();
    await expect(listEncounterSectionConflicts(encounterId, userId)).resolves.toEqual([]);
    expect(Object.keys(window.localStorage)).toEqual(['anamneo-privacy-settings']);
  });
});
