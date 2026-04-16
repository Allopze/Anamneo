import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savingSectionKey, setSavingSectionKey] = useState<SectionKey | null>(null);
  const [savedSectionKey, setSavedSectionKey] = useState<SectionKey | null>(null);
  const [errorSectionKey, setErrorSectionKey] = useState<SectionKey | null>(null);
  const [savedSnapshotJson, setSavedSnapshotJson] = useState('');

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
  });

  const {
    saveSectionMutation,
    persistSection,
    saveCurrentSection,
    ensureActiveSectionSaved,
  } = useEncounterSectionSaveFlow({
    canEdit,
    encounter,
    id,
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
    setSavedSectionKey,
    setSavedSnapshotJson,
    setSaveStatus,
    setSavingSectionKey,
  });

  useEncounterAutosave({
    canEdit,
    hasUnsavedChanges,
    saveCurrentSection,
  });

  const handleSectionDataChange = useCallback(
    (sectionKey: SectionKey, data: any) => {
      if (!canEdit) return;
      setFormData((previous) => ({ ...previous, [sectionKey]: data }));
      setErrorSectionKey((current) => (current === sectionKey ? null : current));
      setSaveStatus('idle');
    },
    [canEdit],
  );

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
    (generatedSummary: string) => {
      const existing = formData.OBSERVACIONES || {};
      const updatedData = { ...existing, resumenClinico: generatedSummary };
      handleSectionDataChange('OBSERVACIONES', updatedData);
      saveSectionMutation.mutate({ sectionKey: 'OBSERVACIONES', data: updatedData });
      toast.success('Resumen longitudinal guardado');
    },
    [formData.OBSERVACIONES, handleSectionDataChange, saveSectionMutation],
  );

  const handleQuickNotesSave = useCallback(
    (text: string) => {
      const existing = formData.OBSERVACIONES || {};
      const updatedData = { ...existing, notasInternas: text };
      handleSectionDataChange('OBSERVACIONES', updatedData);
      saveSectionMutation.mutate({ sectionKey: 'OBSERVACIONES', data: updatedData });
    },
    [formData.OBSERVACIONES, handleSectionDataChange, saveSectionMutation],
  );

  useEffect(() => {
    if (!currentSection) {
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
  }, [currentSection, formData]);

  return {
    formData,
    hasUnsavedChanges,
    saveStatus,
    lastSavedAt,
    savingSectionKey,
    savedSectionKey,
    errorSectionKey,
    savedSnapshotJson,
    pendingSaveCount: offlineQueue.pendingSaveCount,
    saveSectionMutation,
    persistSection,
    saveCurrentSection,
    ensureActiveSectionSaved,
    handleSectionDataChange,
    handleRestoreIdentificationFromPatient,
    handleSaveGeneratedSummary,
    handleQuickNotesSave,
  };
}