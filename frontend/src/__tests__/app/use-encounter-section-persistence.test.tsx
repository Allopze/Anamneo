import { act, renderHook, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useEncounterSectionPersistence } from '@/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence';
import {
  listEncounterSectionConflicts,
  readEncounterSectionConflict,
} from '@/lib/encounter-draft';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/stores/privacy-settings-store', () => ({
  isSharedDeviceModeEnabled: jest.fn(() => false),
  usePrivacySettingsStore: jest.fn(() => ({ hasHydrated: true, sharedDeviceMode: false })),
}));

jest.mock('@/lib/encounter-draft', () => ({
  clearEncounterSectionConflict: jest.fn(),
  hasEncounterDraftUnsavedChanges: jest.fn(({ formData, savedSnapshot }) =>
    JSON.stringify(formData ?? {}) !== JSON.stringify(savedSnapshot ?? {}),
  ),
  listEncounterSectionConflicts: jest.fn(() => []),
  readEncounterDraft: jest.fn(() => null),
  readEncounterSectionConflict: jest.fn(() => null),
}));

jest.mock('@/app/(dashboard)/atenciones/[id]/useEncounterAutosave', () => ({
  useEncounterAutosave: jest.fn(),
}));

jest.mock('@/app/(dashboard)/atenciones/[id]/useEncounterOfflineQueue', () => ({
  useEncounterOfflineQueue: jest.fn(() => ({
    enqueueOfflineSave: jest.fn(),
    pendingSaveCount: 0,
  })),
}));

jest.mock('@/app/(dashboard)/atenciones/[id]/useEncounterDraftSync', () => ({
  useEncounterDraftSync: jest.fn((params) => {
    useEffect(() => {
      if (!params.encounter?.sections) return;

      const initialData = Object.fromEntries(
        params.encounter.sections.map((section: any) => [section.sectionKey, section.data ?? {}]),
      );
      params.setFormData(initialData);
      params.formDataRef.current = initialData;
      params.lastSavedRef.current = JSON.stringify(initialData);
      params.setSavedSnapshotJson(params.lastSavedRef.current);
      params.initializedEncounterIdRef.current = params.encounter.id;
      params.setIsDraftHydrated(true);
      // The production hook hydrates once per encounter id. The test mock mirrors
      // that one-shot behavior so dirty state changes are owned by the hook under test.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  }),
}));

jest.mock('@/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow', () => ({
  useEncounterSectionSaveFlow: jest.fn((params) => ({
    saveSectionMutation: { isPending: false },
    persistSection: jest.fn(async () => 'noop'),
    saveCurrentSection: jest.fn(async () => undefined),
    ensureActiveSectionSaved: jest.fn(async () => true),
    saveSection: jest.fn(async ({ sectionKey, data }: { sectionKey: string; data: any }) => {
      const savedSnapshot = JSON.parse(params.lastSavedRef.current || '{}');
      savedSnapshot[sectionKey] = data ?? {};
      params.lastSavedRef.current = JSON.stringify(savedSnapshot);
      params.setSavedSnapshotJson(params.lastSavedRef.current);
      params.setFormData((previous: Record<string, any>) => ({
        ...previous,
        [sectionKey]: data ?? {},
      }));
      params.formDataRef.current = {
        ...params.formDataRef.current,
        [sectionKey]: data ?? {},
      };
      params.setSaveStatus('saved');
      return 'saved';
    }),
  })),
}));

const sections = [
  {
    id: 'sec-1',
    sectionKey: 'MOTIVO_CONSULTA',
    label: 'Motivo',
    data: { motivo: 'Control' },
    completed: false,
    notApplicable: false,
  },
  {
    id: 'sec-2',
    sectionKey: 'OBSERVACIONES',
    label: 'Observaciones',
    data: { notasInternas: 'Base' },
    completed: false,
    notApplicable: false,
  },
] as any[];

function buildEncounter() {
  return {
    id: 'enc-1',
    status: 'EN_PROGRESO',
    updatedAt: '2026-04-29T12:00:00.000Z',
    sections,
  } as any;
}

function renderPersistence(currentSectionIndex = 0) {
  const encounter = buildEncounter();

  return renderHook(
    ({ index }) =>
      useEncounterSectionPersistence({
        canEdit: true,
        currentSection: sections[index],
        currentSectionIndex: index,
        encounter,
        id: 'enc-1',
        isOnline: true,
        queryClient: {
          invalidateQueries: jest.fn(),
          setQueryData: jest.fn(),
        } as unknown as QueryClient,
        sections,
        setCurrentSectionIndex: jest.fn(),
        userId: 'med-1',
      }),
    { initialProps: { index: currentSectionIndex } },
  );
}

describe('useEncounterSectionPersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listEncounterSectionConflicts as jest.Mock).mockReturnValue([]);
    (readEncounterSectionConflict as jest.Mock).mockReturnValue(null);
  });

  it('tracks dirty state only for the section that changed', async () => {
    const { result, rerender } = renderPersistence();

    await waitFor(() => expect(result.current.isDraftHydrated).toBe(true));

    act(() => {
      result.current.handleSectionDataChange('MOTIVO_CONSULTA', { motivo: 'Dolor lumbar' });
    });

    expect(result.current.dirtySectionKeys).toEqual(['MOTIVO_CONSULTA']);
    expect(result.current.hasUnsavedChanges).toBe(true);

    rerender({ index: 1 });

    await waitFor(() => expect(result.current.hasUnsavedChanges).toBe(false));
    expect(result.current.dirtySectionKeys).toEqual(['MOTIVO_CONSULTA']);

    act(() => {
      result.current.handleSectionDataChange('OBSERVACIONES', { notasInternas: 'Base' });
    });

    expect(result.current.dirtySectionKeys).toEqual(['MOTIVO_CONSULTA']);
  });

  it('clears a section dirty flag after the section is saved successfully', async () => {
    const { result } = renderPersistence();

    await waitFor(() => expect(result.current.isDraftHydrated).toBe(true));

    act(() => {
      result.current.handleSectionDataChange('MOTIVO_CONSULTA', { motivo: 'Dolor lumbar' });
    });

    expect(result.current.dirtySectionKeys).toEqual(['MOTIVO_CONSULTA']);

    await act(async () => {
      await result.current.saveSection({
        sectionKey: 'MOTIVO_CONSULTA',
        data: { motivo: 'Dolor lumbar' },
      });
    });

    await waitFor(() => expect(result.current.dirtySectionKeys).toEqual([]));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('marks only the restored conflict section as dirty', async () => {
    const conflict = {
      version: 2,
      encounterId: 'enc-1',
      userId: 'med-1',
      sectionKey: 'OBSERVACIONES',
      localData: { notasInternas: 'Copia local recuperada' },
      serverData: { notasInternas: 'Base' },
      serverUpdatedAt: '2026-04-29T12:10:00.000Z',
      savedAt: '2026-04-29T12:11:00.000Z',
    };

    (listEncounterSectionConflicts as jest.Mock).mockReturnValue([conflict]);
    (readEncounterSectionConflict as jest.Mock).mockReturnValue(conflict);

    const { result } = renderPersistence(1);

    await waitFor(() => expect(result.current.recoverableConflict).toEqual(conflict));

    act(() => {
      result.current.handleRestoreRecoverableConflict();
    });

    expect(result.current.formData.OBSERVACIONES).toEqual(conflict.localData);
    expect(result.current.dirtySectionKeys).toEqual(['OBSERVACIONES']);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});
