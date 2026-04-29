import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import {
  clearEncounterSectionConflict,
  hasEncounterDraftUnsavedChanges,
  listEncounterSectionConflicts,
  readEncounterDraft,
  readEncounterSectionConflict,
  type EncounterDraft,
  type EncounterSectionConflictBackup,
} from '@/lib/encounter-draft';
import type { Encounter, IdentificacionData, SectionKey } from '@/types';
import { isSharedDeviceModeEnabled, usePrivacySettingsStore } from '@/stores/privacy-settings-store';
import toast from 'react-hot-toast';
import { useEncounterDraftSync } from './useEncounterDraftSync';
import { useEncounterAutosave } from './useEncounterAutosave';
import { useEncounterOfflineQueue } from './useEncounterOfflineQueue';
import { useEncounterSectionSaveFlow } from './useEncounterSectionSaveFlow';

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
  const [dirtySectionKeys, setDirtySectionKeys] = useState<Set<SectionKey>>(() => new Set());
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [localDraft, setLocalDraft] = useState<EncounterDraft | null>(null);
  const [recoverableConflicts, setRecoverableConflicts] = useState<EncounterSectionConflictBackup[]>([]);
  const [recoverableConflict, setRecoverableConflict] = useState<EncounterSectionConflictBackup | null>(null);

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
    if (!userId || effectiveSharedDeviceMode) {
      setLocalDraft(null);
      setRecoverableConflicts([]);
      setRecoverableConflict(null);
      return;
    }

    const visibleSectionKeys = new Set(sections.map((section) => section.sectionKey));
    const storedConflict = sections
      .map((section) => readEncounterSectionConflict(id, userId, section.sectionKey))
      .find((conflict): conflict is EncounterSectionConflictBackup => conflict !== null);
    const storedConflicts = listEncounterSectionConflicts(id, userId).filter((conflict) =>
      visibleSectionKeys.has(conflict.sectionKey as SectionKey));

    setRecoverableConflicts(storedConflicts);
    setRecoverableConflict(storedConflict ?? storedConflicts[0] ?? null);
  }, [effectiveSharedDeviceMode, id, sections, userId]);

  useEffect(() => {
    if (!localDraft) {
      return;
    }

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

  const handleSectionDataChange = useCallback(
    (sectionKey: SectionKey, data: any) => {
      if (!canEdit) return;
      setFormData((previous) => ({ ...previous, [sectionKey]: data }));
      const savedData = savedSnapshotDataRef.current[sectionKey] ?? {};
      const sectionIsDirty = JSON.stringify(data ?? {}) !== JSON.stringify(savedData);
      setDirtySectionKeys((current) => {
        const alreadyDirty = current.has(sectionKey);
        if (alreadyDirty === sectionIsDirty) return current;

        const next = new Set(current);
        if (sectionIsDirty) {
          next.add(sectionKey);
        } else {
          next.delete(sectionKey);
        }
        return next;
      });
      setErrorSectionKey((current) => (current === sectionKey ? null : current));
      setSaveStatus('idle');
    },
    [canEdit],
  );

  const handleRestoreRecoverableConflict = useCallback((sectionKey?: string) => {
    const targetConflict = sectionKey
      ? recoverableConflicts.find((conflict) => conflict.sectionKey === sectionKey)
      : recoverableConflict;
    if (!targetConflict) return;

    const targetSectionIndex = sections.findIndex((section) => section.sectionKey === targetConflict.sectionKey);
    if (targetSectionIndex >= 0 && targetSectionIndex !== currentSectionIndex) {
      setCurrentSectionIndex(targetSectionIndex);
    }

    setFormData((previous) => ({
      ...previous,
      [targetConflict.sectionKey]: targetConflict.localData,
    }));
    setErrorSectionKey(targetConflict.sectionKey as SectionKey);
    setDirtySectionKeys((current) => new Set(current).add(targetConflict.sectionKey as SectionKey));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
    toast.success('Se restauró tu copia local para que puedas revisarla antes de guardar.');
  }, [currentSectionIndex, recoverableConflict, recoverableConflicts, sections, setCurrentSectionIndex]);

  const handleDismissRecoverableConflict = useCallback((sectionKey?: string) => {
    const targetConflict = sectionKey
      ? recoverableConflicts.find((conflict) => conflict.sectionKey === sectionKey)
      : recoverableConflict;
    if (!targetConflict || !userId) return;

    clearEncounterSectionConflict(id, userId, targetConflict.sectionKey);
    setRecoverableConflicts((current) => current.filter((conflict) => conflict.sectionKey !== targetConflict.sectionKey));
    setRecoverableConflict((current) =>
      current?.sectionKey === targetConflict.sectionKey
        ? recoverableConflicts.find((conflict) => conflict.sectionKey !== targetConflict.sectionKey) ?? null
        : current);
    toast.success('Se descartó la copia local en conflicto.');
  }, [id, recoverableConflict, recoverableConflicts, userId]);

  const handleRestoreIdentificationFromPatient = useCallback(async () => {
    if (!encounter) return;

    try {
      const response = await api.post(`/encounters/${id}/reconcile-identification`);
      const reconciledData = response.data.data as IdentificacionData;
      handleSectionDataChange('IDENTIFICACION', reconciledData);

      let snapshot: Record<string, any> = {};
      try {
        snapshot = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        snapshot = {};
      }

      snapshot.IDENTIFICACION = reconciledData;
      lastSavedRef.current = JSON.stringify(snapshot);
      setSavedSnapshotJson(lastSavedRef.current);
      setDirtySectionKeys((current) => {
        if (!current.has('IDENTIFICACION')) return current;
        const next = new Set(current);
        next.delete('IDENTIFICACION');
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      toast.success('Se actualizó la identificación con datos de la ficha del paciente');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [encounter, handleSectionDataChange, id, queryClient]);

  const handleSaveGeneratedSummary = useCallback(
    async (generatedSummary: string) => {
      const existing = formData.OBSERVACIONES || {};
      const updatedData = { ...existing, resumenClinico: generatedSummary };
      handleSectionDataChange('OBSERVACIONES', updatedData);
      const result = await saveSection({ sectionKey: 'OBSERVACIONES', data: updatedData });
      if (result === 'saved') {
        toast.success('Resumen longitudinal guardado');
      }
    },
    [formData.OBSERVACIONES, handleSectionDataChange, saveSection],
  );

  const handleQuickNotesSave = useCallback(
    async (text: string) => {
      const existing = formData.OBSERVACIONES || {};
      const updatedData = { ...existing, notasInternas: text };
      handleSectionDataChange('OBSERVACIONES', updatedData);
      await saveSection({ sectionKey: 'OBSERVACIONES', data: updatedData });
    },
    [formData.OBSERVACIONES, handleSectionDataChange, saveSection],
  );

  useEffect(() => {
    if (!currentSection || !isDraftHydrated) {
      setHasUnsavedChanges(false);
      return;
    }

    setHasUnsavedChanges(dirtySectionKeys.has(currentSection.sectionKey));
  }, [currentSection, dirtySectionKeys, isDraftHydrated]);

  useEffect(() => {
    if (!isDraftHydrated) {
      setDirtySectionKeys(new Set());
      return;
    }

    const savedSnapshot = savedSnapshotDataRef.current;
    const next = new Set<SectionKey>();

    for (const section of sections) {
      const currentData = JSON.stringify(formDataRef.current[section.sectionKey] ?? {});
      const savedData = JSON.stringify(savedSnapshot[section.sectionKey] ?? {});
      if (currentData !== savedData) {
        next.add(section.sectionKey);
      }
    }

    setDirtySectionKeys((current) => {
      if (current.size === next.size && [...current].every((sectionKey) => next.has(sectionKey))) {
        return current;
      }
      return next;
    });
  }, [isDraftHydrated, savedSnapshotJson, sections]);

  useEffect(() => {
    if (!encounter?.sections || !isDraftHydrated) return;

    const savedSnapshot = (() => {
      try {
        return JSON.parse(lastSavedRef.current || '{}') as Record<string, any>;
      } catch {
        return {};
      }
    })();

    let changed = false;
    const nextSnapshot = { ...savedSnapshot };

    encounter.sections.forEach((section) => {
      const localData = formDataRef.current[section.sectionKey];
      const serverData = section.data ?? {};
      const localMatchesServer =
        localData === undefined || JSON.stringify(localData) === JSON.stringify(serverData);

      if (!localMatchesServer) {
        return;
      }

      if (JSON.stringify(nextSnapshot[section.sectionKey]) !== JSON.stringify(serverData)) {
        nextSnapshot[section.sectionKey] = serverData;
        changed = true;
      }
    });

    if (!changed) return;

    lastSavedRef.current = JSON.stringify(nextSnapshot);
    setSavedSnapshotJson(lastSavedRef.current);
  }, [encounter?.sections, isDraftHydrated, setSavedSnapshotJson]);

  const dirtySectionKeyList = useMemo(() => [...dirtySectionKeys], [dirtySectionKeys]);

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
