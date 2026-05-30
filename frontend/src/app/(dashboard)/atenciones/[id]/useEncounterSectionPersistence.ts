import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import {
  hasEncounterDraftUnsavedChanges,
  type EncounterDraft,
} from '@/lib/encounter-draft';
import type { Encounter, SectionKey } from '@/types';
import { isSharedDeviceModeEnabled, usePrivacySettingsStore } from '@/stores/privacy-settings-store';
import { useEncounterDraftSync } from './useEncounterDraftSync';
import { useEncounterAutosave } from './useEncounterAutosave';
import { useEncounterOfflineQueue } from './useEncounterOfflineQueue';
import { useEncounterSectionSaveFlow } from './useEncounterSectionSaveFlow';
import { useEncounterConflictRecovery } from './useEncounterConflictRecovery';
import { useEncounterSectionActions } from './useEncounterSectionActions';
import { useEncounterDirtyTracker } from './useEncounterDirtyTracker';

interface UseEncounterSectionPersistenceParams {
  canEdit: boolean;
  currentSection?: NonNullable<Encounter['sections']>[number];
  currentSectionIndex: number;
  encounter?: Encounter;
  id: string;
  isOnline: boolean;
  queryClient: QueryClient;
  sections: NonNullable<Encounter['sections']>;
  setCurrentSectionIndex: React.Dispatch<React.SetStateAction<number>>;
  userId?: string;
}

export function useEncounterSectionPersistence(params: UseEncounterSectionPersistenceParams) {
  const { hasHydrated, sharedDeviceMode } = usePrivacySettingsStore();
  const effectiveSharedDeviceMode = hasHydrated ? sharedDeviceMode : isSharedDeviceModeEnabled();
  const {
    canEdit,
    currentSection,
    currentSectionIndex,
    encounter,
    id,
    isOnline,
    queryClient,
    sections,
    setCurrentSectionIndex,
    userId,
  } = params;

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'queued' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSaveOrigin, setLastSaveOrigin] = useState<'direct' | 'offline-sync' | null>(null);
  const [savingSectionKey, setSavingSectionKey] = useState<SectionKey | null>(null);
  const [savedSectionKey, setSavedSectionKey] = useState<SectionKey | null>(null);
  const [errorSectionKey, setErrorSectionKey] = useState<SectionKey | null>(null);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState('');
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [localDraft, setLocalDraft] = useState<EncounterDraft | null>(null);

  const lastSavedRef = useRef<string>('');
  const savedSnapshotDataRef = useRef<Record<string, any>>({});
  const formDataRef = useRef<Record<string, any>>({});
  const activeSectionKeyRef = useRef<SectionKey | null>(null);
  const initializedEncounterIdRef = useRef<string | null>(null);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    try {
      savedSnapshotDataRef.current = JSON.parse(savedSnapshotJson || '{}') as Record<string, any>;
    } catch {
      savedSnapshotDataRef.current = {};
    }
  }, [savedSnapshotJson]);

  useEffect(() => {
    activeSectionKeyRef.current = currentSection?.sectionKey ?? null;
  }, [currentSection]);

  const offlineQueue = useEncounterOfflineQueue({
    id,
    isOnline,
    onEncounterSavesSynced: ({ encounterIds, syncedAt }) => {
      if (!encounterIds.includes(id)) return;
      setSaveStatus('saved');
      setLastSavedAt(syncedAt);
      setLastSaveOrigin('offline-sync');
    },
    queryClient,
    userId,
  });

  useEncounterDraftSync({
    encounter,
    userId,
    sectionsLength: sections.length,
    currentSectionIndex,
    formData,
    savedSnapshotJson,
    setFormData,
    setSavedSnapshotJson,
    setCurrentSectionIndex,
    initializedEncounterIdRef,
    formDataRef,
    lastSavedRef,
    setRestoredDraft: setLocalDraft,
    setIsDraftHydrated,
  });

  useEffect(() => {
    if (!localDraft) return;

    let savedSnapshot: Record<string, any> = {};
    try {
      savedSnapshot = JSON.parse(savedSnapshotJson || '{}');
    } catch {
      savedSnapshot = {};
    }

    if (!hasEncounterDraftUnsavedChanges({ formData, savedSnapshot })) {
      setLocalDraft(null);
    }
  }, [formData, localDraft, savedSnapshotJson]);

  // 1. Dirty tracker first — provides setDirtySectionKeys for conflict recovery.
  const { dirtySectionKeys, dirtySectionKeyList, setDirtySectionKeys, handleSectionDataChange } =
    useEncounterDirtyTracker({
      canEdit,
      currentSection,
      encounter,
      isDraftHydrated,
      sections,
      savedSnapshotJson,
      savedSnapshotDataRef,
      formDataRef,
      lastSavedRef,
      setFormData,
      setHasUnsavedChanges,
      setSavedSnapshotJson,
      setErrorSectionKey,
      setSaveStatus,
    });

  // 2. Conflict recovery — needs real setDirtySectionKeys from step 1.
  const {
    recoverableConflicts,
    recoverableConflict,
    setRecoverableConflicts,
    setRecoverableConflict,
    handleRestoreRecoverableConflict,
    handleDismissRecoverableConflict,
  } = useEncounterConflictRecovery({
    id,
    userId,
    sections,
    effectiveSharedDeviceMode,
    currentSectionIndex,
    setCurrentSectionIndex,
    setFormData,
    setErrorSectionKey,
    setDirtySectionKeys,
    setHasUnsavedChanges,
    setSaveStatus,
  });

  // 3. Save flow — needs conflict setters from step 2.
  const {
    saveSection,
    saveSectionMutation,
    persistSection,
    saveCurrentSection,
    ensureActiveSectionSaved,
  } = useEncounterSectionSaveFlow({
    canEdit,
    encounter,
    id,
    isDraftHydrated,
    queryClient,
    sections,
    userId,
    enqueueOfflineSave: offlineQueue.enqueueOfflineSave,
    activeSectionKeyRef,
    formDataRef,
    lastSavedRef,
    setErrorSectionKey,
    setFormData,
    setHasUnsavedChanges,
    setLastSavedAt,
    setLastSaveOrigin,
    setRecoverableConflicts,
    setRecoverableConflict,
    setSavedSectionKey,
    setSavedSnapshotJson,
    setSaveStatus,
    setSavingSectionKey,
  });

  useEncounterAutosave({
    canEdit,
    hasUnsavedChanges,
    isDraftHydrated,
    saveCurrentSection,
  });

  useEffect(() => {
    if (!encounter?.id) {
      setIsDraftHydrated(false);
      initializedEncounterIdRef.current = null;
      return;
    }

    if (initializedEncounterIdRef.current !== encounter.id) {
      setIsDraftHydrated(false);
    }
  }, [encounter?.id]);

  const { handleRestoreIdentificationFromPatient, handleSaveGeneratedSummary, handleQuickNotesSave } =
    useEncounterSectionActions({
      encounter,
      id,
      queryClient,
      formData,
      lastSavedRef,
      setSavedSnapshotJson,
      setDirtySectionKeys,
      handleSectionDataChange,
      saveSection,
    });

  return {
    formData,
    hasUnsavedChanges,
    saveStatus,
    lastSavedAt,
    lastSaveOrigin,
    savingSectionKey,
    savedSectionKey,
    errorSectionKey,
    localDraft,
    recoverableConflicts,
    recoverableConflict,
    savedSnapshotJson,
    dirtySectionKeys: dirtySectionKeyList,
    pendingSaveCount: offlineQueue.pendingSaveCount,
    isDraftHydrated,
    saveSection,
    saveSectionMutation,
    persistSection,
    saveCurrentSection,
    ensureActiveSectionSaved,
    handleSectionDataChange,
    handleRestoreRecoverableConflict,
    handleDismissRecoverableConflict,
    handleRestoreIdentificationFromPatient,
    handleSaveGeneratedSummary,
    handleQuickNotesSave,
  };
}
