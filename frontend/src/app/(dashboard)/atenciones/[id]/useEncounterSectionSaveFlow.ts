import { useCallback, useEffect, useRef } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { isNetworkError, type PendingSave } from '@/lib/offline-queue';
import { invalidateAlertOverviewQueries } from '@/lib/query-invalidation';
import type { Encounter, SectionKey } from '@/types';
import toast from 'react-hot-toast';
import type { SaveSectionResponse } from './encounter-wizard.constants';

interface SaveSectionMutationVars {
  sectionKey: SectionKey;
  data: any;
  completed?: boolean;
  notApplicable?: boolean;
  notApplicableReason?: string;
}

interface UseEncounterSectionSaveFlowParams {
  canEdit: boolean;
  encounter?: Encounter;
  id: string;
  queryClient: QueryClient;
  sections: NonNullable<Encounter['sections']>;
  userId?: string;
  enqueueOfflineSave: (save: Omit<PendingSave, 'id'>) => Promise<void>;
  activeSectionKeyRef: React.MutableRefObject<SectionKey | null>;
  formDataRef: React.MutableRefObject<Record<string, any>>;
  lastSavedRef: React.MutableRefObject<string>;
  setErrorSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setLastSavedAt: React.Dispatch<React.SetStateAction<Date | null>>;
  setSavedSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavedSnapshotJson: React.Dispatch<React.SetStateAction<string>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'error'>>;
  setSavingSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
}

function readSavedSnapshot(lastSavedRef: React.MutableRefObject<string>) {
  try {
    return JSON.parse(lastSavedRef.current || '{}') as Record<string, any>;
  } catch {
    return {};
  }
}

export function useEncounterSectionSaveFlow(params: UseEncounterSectionSaveFlowParams) {
  const {
    canEdit,
    encounter,
    id,
    queryClient,
    sections,
    userId,
    enqueueOfflineSave,
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
  } = params;

  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSectionMutation = useMutation({
    mutationFn: async ({
      sectionKey,
      data,
      completed,
      notApplicable,
      notApplicableReason,
    }: SaveSectionMutationVars) => {
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
      const savedSnapshot = readSavedSnapshot(lastSavedRef);
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
        void enqueueOfflineSave({
          encounterId: id,
          sectionKey: variables.sectionKey,
          data: variables.data,
          completed: variables.completed,
          notApplicable: variables.notApplicable,
          notApplicableReason: variables.notApplicableReason,
          queuedAt: new Date().toISOString(),
          userId,
        }).catch(() => {
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
      const savedSnapshot = readSavedSnapshot(lastSavedRef);
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
    [
      activeSectionKeyRef,
      canEdit,
      encounter?.sections,
      formDataRef,
      lastSavedRef,
      saveSectionMutation,
      sections,
      setSaveStatus,
    ],
  );

  const saveCurrentSection = useCallback(() => {
    void persistSection();
  }, [persistSection]);

  const ensureActiveSectionSaved = useCallback(async () => {
    const sectionKey = activeSectionKeyRef.current;
    if (!sectionKey) return true;

    const currentData = JSON.stringify(formDataRef.current[sectionKey] ?? {});
    const savedSnapshot = readSavedSnapshot(lastSavedRef);
    const savedData = JSON.stringify(savedSnapshot[sectionKey] ?? {});
    if (currentData === savedData) return true;

    try {
      await saveSectionMutation.mutateAsync({
        sectionKey,
        data: formDataRef.current[sectionKey],
      });
      return true;
    } catch {
      return false;
    }
  }, [activeSectionKeyRef, formDataRef, lastSavedRef, saveSectionMutation]);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  return {
    saveSectionMutation,
    persistSection,
    saveCurrentSection,
    ensureActiveSectionSaved,
  };
}