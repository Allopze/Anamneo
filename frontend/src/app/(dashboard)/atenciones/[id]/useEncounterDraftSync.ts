import { useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Encounter } from '@/types';
import {
  clearEncounterDraft,
  hasEncounterDraftUnsavedChanges,
  readEncounterDraft,
  writeEncounterDraft,
} from '@/lib/encounter-draft';
import { isSharedDeviceModeEnabled, usePrivacySettingsStore } from '@/stores/privacy-settings-store';

interface UseEncounterDraftSyncParams {
  encounter?: Encounter;
  userId?: string;
  sectionsLength: number;
  currentSectionIndex: number;
  formData: Record<string, any>;
  savedSnapshotJson: string;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setSavedSnapshotJson: React.Dispatch<React.SetStateAction<string>>;
  setCurrentSectionIndex: React.Dispatch<React.SetStateAction<number>>;
  initializedEncounterIdRef: React.MutableRefObject<string | null>;
  formDataRef: React.MutableRefObject<Record<string, any>>;
  lastSavedRef: React.MutableRefObject<string>;
  setIsDraftHydrated: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useEncounterDraftSync(params: UseEncounterDraftSyncParams) {
  const { hasHydrated, sharedDeviceMode } = usePrivacySettingsStore();
  const effectiveSharedDeviceMode = hasHydrated ? sharedDeviceMode : isSharedDeviceModeEnabled();
  const {
    encounter,
    userId,
    sectionsLength,
    currentSectionIndex,
    formData,
    savedSnapshotJson,
    setFormData,
    setSavedSnapshotJson,
    setCurrentSectionIndex,
    initializedEncounterIdRef,
    formDataRef,
    lastSavedRef,
    setIsDraftHydrated,
  } = params;

  useEffect(() => {
    if (!encounter?.sections || encounter.id === initializedEncounterIdRef.current) {
      return;
    }

    initializedEncounterIdRef.current = encounter.id;

    const initialData: Record<string, any> = {};
    encounter.sections.forEach((section) => {
      initialData[section.sectionKey] = section.data;
    });

    const storedDraft = effectiveSharedDeviceMode || !userId ? null : readEncounterDraft(encounter.id, userId);
    const draftIsStale =
      storedDraft?.encounterUpdatedAt
      && encounter.updatedAt
      && new Date(encounter.updatedAt).getTime() > new Date(storedDraft.encounterUpdatedAt).getTime();

    const useDraft = storedDraft && !draftIsStale;
    const restoredFormData = useDraft ? storedDraft.formData : initialData;
    const restoredSavedSnapshot = useDraft ? storedDraft.savedSnapshot : initialData;

    setFormData(restoredFormData);
    formDataRef.current = restoredFormData;
    lastSavedRef.current = JSON.stringify(restoredSavedSnapshot);
    setSavedSnapshotJson(lastSavedRef.current);
    setCurrentSectionIndex(
      Math.min(Math.max(useDraft ? storedDraft.currentSectionIndex : 0, 0), Math.max(sectionsLength - 1, 0)),
    );
    setIsDraftHydrated(true);

    if (draftIsStale && storedDraft && hasEncounterDraftUnsavedChanges(storedDraft)) {
      toast('Se descartó un borrador local porque la atención fue actualizada en otra sesión', { icon: '⚠️' });
      if (userId) clearEncounterDraft(encounter.id, userId);
    } else if (useDraft && hasEncounterDraftUnsavedChanges(storedDraft)) {
      toast.success('Se restauró un borrador local de esta atención');
    }
  }, [
    encounter,
    formDataRef,
    initializedEncounterIdRef,
    lastSavedRef,
    sectionsLength,
    setCurrentSectionIndex,
    setFormData,
    setIsDraftHydrated,
    setSavedSnapshotJson,
    effectiveSharedDeviceMode,
    userId,
  ]);

  useEffect(() => {
    if (!encounter?.id || !userId) return;
    if (initializedEncounterIdRef.current !== encounter.id) return;

    if (encounter.status !== 'EN_PROGRESO') {
      clearEncounterDraft(encounter.id, userId);
      return;
    }

    const savedSnapshot = (() => {
      try {
        return JSON.parse(savedSnapshotJson || '{}') as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const draft = {
      version: 2,
      encounterId: encounter.id,
      userId,
      currentSectionIndex,
      formData,
      savedSnapshot,
      encounterUpdatedAt: encounter.updatedAt,
    };

    if (effectiveSharedDeviceMode) {
      clearEncounterDraft(encounter.id, userId);
      return;
    }

    if (hasEncounterDraftUnsavedChanges(draft)) {
      writeEncounterDraft(draft);
      return;
    }

    clearEncounterDraft(encounter.id, userId);
  }, [
    currentSectionIndex,
    encounter?.id,
    encounter?.status,
    encounter?.updatedAt,
    formData,
    initializedEncounterIdRef,
    savedSnapshotJson,
    effectiveSharedDeviceMode,
    userId,
  ]);
}
