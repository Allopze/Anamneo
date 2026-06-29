import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { isNetworkError } from '@/lib/offline-queue';
import { isSharedDeviceModeEnabled } from '@/stores/privacy-settings-store';
import type { Encounter, SectionKey } from '@/types';
import type { SaveSectionResponse } from './encounter-wizard.constants';
import {
  buildSectionUpdatedAtSnapshot,
  getPersistedSectionUpdatedAt,
  getSectionPayloadData,
  handleSaveSectionError,
  handleSaveSectionSuccess,
  readSavedSnapshot,
  refreshSectionFromServer,
  type PersistSectionResult,
  type SaveSectionMutationVars,
  type SaveSectionSuccessCtx,
  type UseEncounterSectionSaveFlowParams,
} from './useEncounterSectionSaveFlow.helpers';

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
    setRecoverableConflicts,
    setRecoverableConflict,
    setSavedSectionKey,
    setSavedSnapshotJson,
    setSaveStatus,
    setSavingSectionKey,
  } = params;

  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSectionUpdatedAtRef = useRef<Partial<Record<SectionKey, string>>>(
    buildSectionUpdatedAtSnapshot(sections),
  );

  useEffect(() => {
    latestSectionUpdatedAtRef.current = {
      ...latestSectionUpdatedAtRef.current,
      ...buildSectionUpdatedAtSnapshot(sections),
    };
  }, [sections]);

  // Build shared context objects passed to extracted handler helpers.
  const refreshCtx = {
    id,
    userId,
    queryClient,
    latestSectionUpdatedAtRef,
    activeSectionKeyRef,
    lastSavedRef,
    setFormData,
    setSavedSnapshotJson,
    setHasUnsavedChanges,
    setSavingSectionKey,
    setSavedSectionKey,
    setErrorSectionKey,
    setRecoverableConflicts,
    setRecoverableConflict,
    setSaveStatus,
    setLastSavedAt,
    setLastSaveOrigin,
  } as const;

  const successCtx: SaveSectionSuccessCtx = {
    ...refreshCtx,
    formDataRef,
    saveStatusTimerRef,
  };

  const errorCtx = {
    id,
    userId,
    encounter,
    sections,
    formDataRef,
    enqueueOfflineSave,
    queryClient,
    refreshCtx,
    setErrorSectionKey,
    setSavingSectionKey,
    setSavedSectionKey,
    setSaveStatus,
  } as const;

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
    onSuccess: (response, variables) => handleSaveSectionSuccess(response, variables, successCtx),
    onError: (error, variables) => handleSaveSectionError(error, variables, errorCtx),
  });

  const saveSection = useCallback(
    async ({
      sectionKey,
      data,
      completed,
      notApplicable,
      notApplicableReason,
    }: SaveSectionMutationVars): Promise<PersistSectionResult> => {
      if (!canEdit || !encounter?.sections || !isDraftHydrated) return 'noop';

      const currentData =
        data ??
        getSectionPayloadData({ encounter, sections, formDataRef, sectionKey });
      const persistedSection = sections.find((section) => section.sectionKey === sectionKey);
      const savedSnapshot = readSavedSnapshot(lastSavedRef);
      const savedSectionData = JSON.stringify(savedSnapshot[sectionKey]);
      const currentSectionData = JSON.stringify(currentData);
      const shouldSaveData = currentSectionData !== savedSectionData;
      const shouldSaveCompletion =
        completed !== undefined && persistedSection?.completed !== completed;
      const shouldSaveNotApplicable =
        notApplicable !== undefined && persistedSection?.notApplicable !== notApplicable;
      const normalizedReason = notApplicable ? (notApplicableReason ?? null) : null;
      const shouldSaveNotApplicableReason =
        notApplicable && persistedSection?.notApplicableReason !== normalizedReason;

      if (
        !shouldSaveData &&
        !shouldSaveCompletion &&
        !shouldSaveNotApplicable &&
        !shouldSaveNotApplicableReason
      ) {
        return 'noop';
      }

      setSaveStatus('saving');
      try {
        await saveSectionMutation.mutateAsync({
          sectionKey,
          data: currentData,
          baseUpdatedAt:
            latestSectionUpdatedAtRef.current[sectionKey] ??
            getPersistedSectionUpdatedAt(sections, sectionKey),
          ...(completed !== undefined ? { completed } : {}),
          ...(notApplicable !== undefined ? { notApplicable } : {}),
          ...(normalizedReason ? { notApplicableReason: normalizedReason } : {}),
        });
        return 'saved';
      } catch (error) {
        if (isNetworkError(error) && id && userId && !isSharedDeviceModeEnabled()) {
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
      saveSectionMutation,
      sections,
      setSaveStatus,
      userId,
    ],
  );

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
    [activeSectionKeyRef, canEdit, encounter?.sections, isDraftHydrated, saveSection],
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
    const timer = saveStatusTimerRef.current;
    return () => {
      if (timer) clearTimeout(timer);
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
