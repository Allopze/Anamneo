import { useCallback, useEffect, useRef } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api, getErrorMessage } from '@/lib/api';
import {
  clearEncounterSectionConflict,
  writeEncounterSectionConflict,
  type EncounterSectionConflictBackup,
} from '@/lib/encounter-draft';
import { isNetworkError, type PendingSave } from '@/lib/offline-queue';
import { invalidateAlertOverviewQueries } from '@/lib/query-invalidation';
import type { Encounter, SectionKey } from '@/types';
import toast from 'react-hot-toast';
import type { SaveSectionResponse } from './encounter-wizard.constants';

interface SaveSectionMutationVars {
  sectionKey: SectionKey;
  data: any;
  baseUpdatedAt?: string;
  completed?: boolean;
  notApplicable?: boolean;
  notApplicableReason?: string;
}

type PersistSectionResult = 'noop' | 'saved' | 'queued';

interface UseEncounterSectionSaveFlowParams {
  canEdit: boolean;
  encounter?: Encounter;
  id: string;
  isDraftHydrated: boolean;
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
  setLastSaveOrigin: React.Dispatch<React.SetStateAction<'direct' | 'offline-sync' | null>>;
  setRecoverableConflict: React.Dispatch<React.SetStateAction<EncounterSectionConflictBackup | null>>;
  setSavedSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSavedSnapshotJson: React.Dispatch<React.SetStateAction<string>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'queued' | 'error'>>;
  setSavingSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
}

function readSavedSnapshot(lastSavedRef: React.MutableRefObject<string>) {
  try {
    return JSON.parse(lastSavedRef.current || '{}') as Record<string, any>;
  } catch {
    return {};
  }
}

function getPersistedSectionUpdatedAt(
  sections: NonNullable<Encounter['sections']>,
  sectionKey: SectionKey,
): string | undefined {
  return sections.find((section) => section.sectionKey === sectionKey)?.updatedAt;
}

function buildIdentificationSnapshot(encounter?: Encounter): Record<string, unknown> {
  return {
    nombre: encounter?.patient?.nombre ?? '',
    rut: encounter?.patient?.rut ?? '',
    rutExempt: Boolean(encounter?.patient?.rutExempt),
    rutExemptReason: encounter?.patient?.rutExemptReason ?? '',
    edad: encounter?.patient?.edad ?? '',
    edadMeses: encounter?.patient?.edadMeses ?? null,
    sexo: encounter?.patient?.sexo ?? '',
    prevision: encounter?.patient?.prevision ?? '',
    trabajo: encounter?.patient?.trabajo ?? '',
    domicilio: encounter?.patient?.domicilio ?? '',
  };
}

function getSectionPayloadData(params: {
  encounter?: Encounter;
  sections: NonNullable<Encounter['sections']>;
  formDataRef: React.MutableRefObject<Record<string, any>>;
  sectionKey: SectionKey;
}) {
  const { encounter, sections, formDataRef, sectionKey } = params;
  const currentFormData = formDataRef.current[sectionKey];
  if (currentFormData !== undefined) {
    return currentFormData;
  }

  const persistedSection = sections.find((section) => section.sectionKey === sectionKey);

  if (sectionKey === 'IDENTIFICACION') {
    return persistedSection?.data ?? buildIdentificationSnapshot(encounter);
  }

  return persistedSection?.data ?? {};
}

export function useEncounterSectionSaveFlow(params: UseEncounterSectionSaveFlowParams) {
  const {
    canEdit,
    encounter,
    id,
    isDraftHydrated,
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
    setLastSaveOrigin,
    setRecoverableConflict,
    setSavedSectionKey,
    setSavedSnapshotJson,
    setSaveStatus,
    setSavingSectionKey,
  } = params;

  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSectionFromServer = useCallback(
    async (sectionKey: SectionKey, localDataForConflict?: Record<string, unknown>) => {
      const response = await api.get<Encounter>(`/encounters/${id}`);
      const latestEncounter = response.data;
      const latestSection = latestEncounter.sections?.find((section) => section.sectionKey === sectionKey);

      queryClient.setQueryData(['encounter', id], latestEncounter);

      if (!latestSection) {
        setSaveStatus('idle');
        setErrorSectionKey(null);
        return;
      }

      const normalizedServerData = (latestSection.data ?? {}) as Record<string, unknown>;
      if (localDataForConflict && userId) {
        const conflictBackup: EncounterSectionConflictBackup = {
          version: 2,
          encounterId: id,
          userId,
          sectionKey,
          localData: localDataForConflict,
          serverData: normalizedServerData,
          serverUpdatedAt: latestSection.updatedAt,
        };
        writeEncounterSectionConflict(conflictBackup);
        setRecoverableConflict(conflictBackup);
      }

      setFormData((previous) => ({
        ...previous,
        [sectionKey]: normalizedServerData,
      }));

      const savedSnapshot = readSavedSnapshot(lastSavedRef);
      savedSnapshot[sectionKey] = normalizedServerData;
      lastSavedRef.current = JSON.stringify(savedSnapshot);
      setSavedSnapshotJson(lastSavedRef.current);
      setHasUnsavedChanges((current) => (activeSectionKeyRef.current === sectionKey ? false : current));
      setLastSavedAt(new Date(latestSection.updatedAt));
      setLastSaveOrigin(null);
      setSavingSectionKey(null);
      setSavedSectionKey(null);
      setErrorSectionKey(localDataForConflict ? sectionKey : null);
      setSaveStatus(localDataForConflict ? 'error' : 'idle');
    },
    [activeSectionKeyRef, id, lastSavedRef, queryClient, setErrorSectionKey, setFormData, setHasUnsavedChanges, setLastSavedAt, setLastSaveOrigin, setRecoverableConflict, setSavedSectionKey, setSavedSnapshotJson, setSaveStatus, setSavingSectionKey, userId],
  );

  const saveSection = useCallback(
    async ({
      sectionKey,
      data,
      completed,
      notApplicable,
      notApplicableReason,
    }: SaveSectionMutationVars): Promise<PersistSectionResult> => {
      if (!canEdit || !encounter?.sections || !isDraftHydrated) return 'noop';

      const currentData = data ?? getSectionPayloadData({
        encounter,
        sections,
        formDataRef,
        sectionKey,
      });
      const persistedSection = sections.find((section) => section.sectionKey === sectionKey);
      const savedSnapshot = readSavedSnapshot(lastSavedRef);
      const savedSectionData = JSON.stringify(savedSnapshot[sectionKey]);
      const currentSectionData = JSON.stringify(currentData);
      const shouldSaveData = currentSectionData !== savedSectionData;
      const shouldSaveCompletion = completed !== undefined && persistedSection?.completed !== completed;
      const shouldSaveNotApplicable = notApplicable !== undefined && persistedSection?.notApplicable !== notApplicable;
      const normalizedReason = notApplicable ? (notApplicableReason ?? null) : null;
      const shouldSaveNotApplicableReason = notApplicable && persistedSection?.notApplicableReason !== normalizedReason;

      if (!shouldSaveData && !shouldSaveCompletion && !shouldSaveNotApplicable && !shouldSaveNotApplicableReason) {
        return 'noop';
      }

      setSaveStatus('saving');
      try {
        await saveSectionMutation.mutateAsync({
          sectionKey,
          data: currentData,
          baseUpdatedAt: getPersistedSectionUpdatedAt(sections, sectionKey),
          ...(completed !== undefined ? { completed } : {}),
          ...(notApplicable !== undefined ? { notApplicable } : {}),
          ...(normalizedReason ? { notApplicableReason: normalizedReason } : {}),
        });
        return 'saved';
      } catch (error) {
        if (isNetworkError(error) && id && userId) {
          return 'queued';
        }
        throw error;
      }
    },
    [
      canEdit,
      encounter,
      formDataRef,
      id,
      isDraftHydrated,
      lastSavedRef,
      sections,
      setSaveStatus,
      userId,
    ],
  );

  const saveSectionMutation = useMutation({
    mutationFn: async ({
      sectionKey,
      data,
      baseUpdatedAt,
      completed,
      notApplicable,
      notApplicableReason,
    }: SaveSectionMutationVars) => {
      return api.put<SaveSectionResponse>(`/encounters/${id}/sections/${sectionKey}`, {
        data,
        baseUpdatedAt,
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
                  updatedAt: response.data.updatedAt,
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
      if (userId) {
        clearEncounterSectionConflict(id, userId, variables.sectionKey);
      }
      setRecoverableConflict((current) => (current?.sectionKey === variables.sectionKey ? null : current));
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      setLastSaveOrigin('direct');
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
          baseUpdatedAt: variables.baseUpdatedAt,
          completed: variables.completed,
          notApplicable: variables.notApplicable,
          notApplicableReason: variables.notApplicableReason,
          queuedAt: new Date().toISOString(),
          userId,
        }).catch(() => {
          setErrorSectionKey(variables.sectionKey);
          setSaveStatus('error');
          toast.error('No se pudo encolar el guardado offline. Reintente manualmente.');
        });
        setErrorSectionKey(null);
        setSaveStatus('queued');
        toast('Sin conexión — guardado en cola local', { icon: '📡' });
        return;
      }

      setErrorSectionKey(variables.sectionKey);
      setSaveStatus('error');
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const localConflictData = (variables.data ?? getSectionPayloadData({
          encounter,
          sections,
          formDataRef,
          sectionKey: variables.sectionKey,
        })) as Record<string, unknown>;

        void refreshSectionFromServer(variables.sectionKey, localConflictData)
          .then(() => {
            toast.error('La sección cambió en otra sesión. Se guardó tu copia local para que puedas recuperarla.');
          })
          .catch(() => {
            void queryClient.invalidateQueries({ queryKey: ['encounter', id] });
            toast.error('La sección cambió en otra sesión. Recargue la atención y revise antes de reintentar.');
          });
        return;
      }
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
    } = {}): Promise<PersistSectionResult> => {
      if (!canEdit || !encounter?.sections || !isDraftHydrated) return 'noop';

      const targetSectionKey = sectionKey ?? activeSectionKeyRef.current;
      if (!targetSectionKey) return 'noop';
      return saveSection({ sectionKey: targetSectionKey, completed, data: undefined });
    },
    [
      activeSectionKeyRef,
      canEdit,
      encounter?.sections,
      isDraftHydrated,
      saveSection,
    ],
  );

  const saveCurrentSection = useCallback(async () => {
    await persistSection();
  }, [persistSection]);

  const ensureActiveSectionSaved = useCallback(async () => {
    const sectionKey = activeSectionKeyRef.current;
    if (!sectionKey) return true;
    if (!isDraftHydrated) return true;

    const currentData = JSON.stringify(formDataRef.current[sectionKey] ?? {});
    const savedSnapshot = readSavedSnapshot(lastSavedRef);
    const savedData = JSON.stringify(savedSnapshot[sectionKey] ?? {});
    if (currentData === savedData) return true;

    try {
      const result = await saveSection({
        sectionKey,
        data: formDataRef.current[sectionKey],
      });
      return result !== 'queued';
    } catch {
      return false;
    }
  }, [activeSectionKeyRef, formDataRef, isDraftHydrated, lastSavedRef, saveSection]);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  return {
    saveSection,
    saveSectionMutation,
    persistSection,
    saveCurrentSection,
    ensureActiveSectionSaved,
  };
}
