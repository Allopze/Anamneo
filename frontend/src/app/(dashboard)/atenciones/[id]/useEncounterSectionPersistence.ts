import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { isNetworkError } from '@/lib/offline-queue';
import { invalidateAlertOverviewQueries } from '@/lib/query-invalidation';
import type { Encounter, IdentificacionData, SectionKey } from '@/types';
import toast from 'react-hot-toast';
import type { SaveSectionResponse } from './encounter-wizard.constants';
import { useEncounterDraftSync } from './useEncounterDraftSync';
import { useEncounterAutosave } from './useEncounterAutosave';
import { useEncounterOfflineQueue } from './useEncounterOfflineQueue';

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
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  const saveSectionMutation = useMutation({
    mutationFn: async ({
      sectionKey,
      data,
      completed,
      notApplicable,
      notApplicableReason,
    }: {
      sectionKey: SectionKey;
      data: any;
      completed?: boolean;
      notApplicable?: boolean;
      notApplicableReason?: string;
    }) => {
      return api.put<SaveSectionResponse>(`/encounters/${id}/sections/${sectionKey}`, {
        data,
        completed,
        notApplicable,
        ...(notApplicableReason ? { notApplicableReason } : {}),
      });
    },
    onMutate: (variables) => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      setSavingSectionKey(variables.sectionKey);
      setSavedSectionKey(null);
      setErrorSectionKey(null);
      setSaveStatus('saving');
    },
    onSuccess: async (response, variables) => {
      let savedSnapshot: Record<string, any> = {};
      try {
        savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        savedSnapshot = {};
      }

      const normalizedSectionData = response.data.data;
      savedSnapshot[variables.sectionKey] = normalizedSectionData;
      lastSavedRef.current = JSON.stringify(savedSnapshot);
      setSavedSnapshotJson(lastSavedRef.current);
      setFormData((previous) => ({
        ...previous,
        [variables.sectionKey]: normalizedSectionData,
      }));

      queryClient.setQueryData<Encounter | undefined>(['encounter', id], (previous) => {
        if (!previous?.sections) return previous;
        return {
          ...previous,
          sections: previous.sections.map((section) =>
            section.sectionKey === variables.sectionKey
              ? {
                  ...section,
                  data: normalizedSectionData,
                  completed: response.data.completed,
                  notApplicable: response.data.notApplicable,
                  notApplicableReason: response.data.notApplicableReason,
                }
              : section,
          ),
        };
      });

      const activeSectionKey = activeSectionKeyRef.current;
      if (activeSectionKey) {
        const activeData = JSON.stringify(formDataRef.current[activeSectionKey]);
        const activeSavedData = JSON.stringify(savedSnapshot[activeSectionKey]);
        setHasUnsavedChanges(activeData !== activeSavedData);
      } else {
        setHasUnsavedChanges(false);
      }

      setSavingSectionKey(null);
      setSavedSectionKey(variables.sectionKey);
      setErrorSectionKey(null);
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      response.data.warnings?.forEach((warning) => toast(warning, { icon: '⚠️' }));

      if (variables.sectionKey === 'EXAMEN_FISICO') {
        await invalidateAlertOverviewQueries(queryClient);
      }

      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
        setSavedSectionKey((current) => (current === variables.sectionKey ? null : current));
      }, 2000);
    },
    onError: (error, variables) => {
      setSavingSectionKey(null);
      setSavedSectionKey(null);

      if (isNetworkError(error) && id && userId) {
        void offlineQueue.enqueueOfflineSave({
          encounterId: id,
          sectionKey: variables.sectionKey,
          data: variables.data,
          completed: variables.completed,
          notApplicable: variables.notApplicable,
          notApplicableReason: variables.notApplicableReason,
          queuedAt: new Date().toISOString(),
          userId,
        })
          .catch(() => {
            toast.error('No se pudo encolar el guardado offline. Reintente manualmente.');
          });
        setSaveStatus('idle');
        toast('Sin conexión — guardado en cola local', { icon: '📡' });
        return;
      }

      setErrorSectionKey(variables.sectionKey);
      setSaveStatus('error');
      toast.error('Error al guardar: ' + getErrorMessage(error));
    },
  });

  const persistSection = useCallback(
    async ({
      sectionKey,
      completed,
    }: {
      sectionKey?: SectionKey;
      completed?: boolean;
    } = {}) => {
      if (!canEdit || !encounter?.sections) return;

      const targetSectionKey = sectionKey ?? activeSectionKeyRef.current;
      if (!targetSectionKey) return;

      const currentData = formDataRef.current[targetSectionKey];
      let savedSnapshot: Record<string, any> = {};
      try {
        savedSnapshot = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        savedSnapshot = {};
      }

      const savedSectionData = JSON.stringify(savedSnapshot[targetSectionKey]);
      const currentSectionData = JSON.stringify(currentData);
      const persistedSection = sections.find((section) => section.sectionKey === targetSectionKey);
      const shouldSaveData = currentSectionData !== savedSectionData;
      const shouldSaveCompletion = completed !== undefined && persistedSection?.completed !== completed;

      if (!shouldSaveData && !shouldSaveCompletion) return;

      setSaveStatus('saving');
      await saveSectionMutation.mutateAsync({
        sectionKey: targetSectionKey,
        data: currentData,
        ...(completed !== undefined ? { completed } : {}),
      });
    },
    [canEdit, encounter?.sections, saveSectionMutation, sections],
  );

  const saveCurrentSection = useCallback(() => {
    void persistSection();
  }, [persistSection]);

  useEncounterAutosave({
    canEdit,
    hasUnsavedChanges,
    saveCurrentSection,
  });

  const ensureActiveSectionSaved = useCallback(async () => {
    if (!hasUnsavedChanges) return true;

    const sectionKey = activeSectionKeyRef.current;
    if (!sectionKey) return true;

    try {
      await saveSectionMutation.mutateAsync({
        sectionKey,
        data: formDataRef.current[sectionKey],
      });
      return true;
    } catch {
      return false;
    }
  }, [hasUnsavedChanges, saveSectionMutation]);

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
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

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