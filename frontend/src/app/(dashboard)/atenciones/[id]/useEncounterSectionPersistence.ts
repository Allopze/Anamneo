import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import {
  clearEncounterSectionConflict,
  readEncounterSectionConflict,
  type EncounterSectionConflictBackup,
} from '@/lib/encounter-draft';
import type { Encounter, IdentificacionData, SectionKey } from '@/types';
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
  const [recoverableConflict, setRecoverableConflict] = useState<EncounterSectionConflictBackup | null>(null);

  const lastSavedRef = useRef<string>('');
  const formDataRef = useRef<Record<string, any>>({});
  const activeSectionKeyRef = useRef<SectionKey | null>(null);
  const initializedEncounterIdRef = useRef<string | null>(null);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

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
    setIsDraftHydrated,
  });

  useEffect(() => {
    if (!userId) {
      setRecoverableConflict(null);
      return;
    }
    const storedConflict = sections
      .map((section) => readEncounterSectionConflict(id, userId, section.sectionKey))
      .find((conflict): conflict is EncounterSectionConflictBackup => conflict !== null);

    if (storedConflict) {
      setRecoverableConflict(storedConflict);
      return;
    }
    setRecoverableConflict((current) => {
      if (current?.encounterId === id) {
        return current;
      }
      return null;
    });
  }, [currentSection?.sectionKey, id, sections, userId]);

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
      setErrorSectionKey((current) => (current === sectionKey ? null : current));
      setSaveStatus('idle');
    },
    [canEdit],
  );

  const handleRestoreRecoverableConflict = useCallback(() => {
    if (!recoverableConflict) return;

    setFormData((previous) => ({
      ...previous,
      [recoverableConflict.sectionKey]: recoverableConflict.localData,
    }));
    setErrorSectionKey(recoverableConflict.sectionKey as SectionKey);
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
    toast.success('Se restauró tu copia local para que puedas revisarla antes de guardar.');
  }, [recoverableConflict]);

  const handleDismissRecoverableConflict = useCallback(() => {
    if (!recoverableConflict || !userId) return;

    clearEncounterSectionConflict(id, userId, recoverableConflict.sectionKey);
    setRecoverableConflict(null);
    toast.success('Se descartó la copia local en conflicto.');
  }, [id, recoverableConflict, userId]);

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
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      toast.success('Se restauró la identificación desde la ficha maestra del paciente');
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

    let savedSnapshot: Record<string, any> = {};
    try {
      savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
    } catch {
      savedSnapshot = {};
    }

    const currentData = JSON.stringify(formData[currentSection.sectionKey] ?? {});
    const savedData = JSON.stringify(savedSnapshot[currentSection.sectionKey] ?? {});
    setHasUnsavedChanges(currentData !== savedData);
  }, [currentSection, formData, isDraftHydrated]);

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

  return {
    formData,
    hasUnsavedChanges,
    saveStatus,
    lastSavedAt,
    lastSaveOrigin,
    savingSectionKey,
    savedSectionKey,
    errorSectionKey,
    recoverableConflict,
    savedSnapshotJson,
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
