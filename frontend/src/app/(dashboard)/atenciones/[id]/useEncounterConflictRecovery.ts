import { useCallback, useEffect, useState } from 'react';
import {
  clearEncounterSectionConflict,
  listEncounterSectionConflicts,
  readEncounterSectionConflict,
  type EncounterSectionConflictBackup,
} from '@/lib/encounter-draft';
import { notify } from '@/lib/notify';
import type { Encounter, SectionKey } from '@/types';

interface UseEncounterConflictRecoveryParams {
  id: string;
  userId: string | undefined;
  sections: NonNullable<Encounter['sections']>;
  effectiveSharedDeviceMode: boolean;
  currentSectionIndex: number;
  setCurrentSectionIndex: React.Dispatch<React.SetStateAction<number>>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setErrorSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setDirtySectionKeys: React.Dispatch<React.SetStateAction<Set<SectionKey>>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'queued' | 'error'>>;
}

/**
 * Manages recoverable section conflicts that arise from multi-tab or
 * offline/online sync collisions. Exposes handlers to restore or dismiss
 * each conflict.
 */
export function useEncounterConflictRecovery({
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
}: UseEncounterConflictRecoveryParams) {
  const [recoverableConflicts, setRecoverableConflicts] = useState<EncounterSectionConflictBackup[]>([]);
  const [recoverableConflict, setRecoverableConflict] = useState<EncounterSectionConflictBackup | null>(null);

  useEffect(() => {
    if (!userId || effectiveSharedDeviceMode) {
      setRecoverableConflicts([]);
      setRecoverableConflict(null);
      return;
    }

    let cancelled = false;
    const activeUserId = userId;

    async function loadRecoverableConflicts() {
      const visibleSectionKeys = new Set(sections.map((section) => section.sectionKey));
      const conflictsBySection = await Promise.all(
        sections.map((section) => readEncounterSectionConflict(id, activeUserId, section.sectionKey)),
      );
      const storedConflict = conflictsBySection.find(
        (conflict): conflict is EncounterSectionConflictBackup => conflict !== null,
      );
      const storedConflicts = (await listEncounterSectionConflicts(id, activeUserId)).filter(
        (conflict) => visibleSectionKeys.has(conflict.sectionKey as SectionKey),
      );

      if (cancelled) return;
      setRecoverableConflicts(storedConflicts);
      setRecoverableConflict(storedConflict ?? storedConflicts[0] ?? null);
    }

    void loadRecoverableConflicts();
    return () => {
      cancelled = true;
    };
  }, [effectiveSharedDeviceMode, id, sections, userId]);

  const handleRestoreRecoverableConflict = useCallback(
    (sectionKey?: string) => {
      const targetConflict = sectionKey
        ? recoverableConflicts.find((conflict) => conflict.sectionKey === sectionKey)
        : recoverableConflict;
      if (!targetConflict) return;

      const targetSectionIndex = sections.findIndex(
        (section) => section.sectionKey === targetConflict.sectionKey,
      );
      if (targetSectionIndex >= 0 && targetSectionIndex !== currentSectionIndex) {
        setCurrentSectionIndex(targetSectionIndex);
      }

      setFormData((previous) => ({
        ...previous,
        [targetConflict.sectionKey]: targetConflict.localData,
      }));
      setErrorSectionKey(targetConflict.sectionKey as SectionKey);
      setDirtySectionKeys((current) =>
        new Set(current).add(targetConflict.sectionKey as SectionKey),
      );
      setHasUnsavedChanges(true);
      setSaveStatus('idle');
      notify.success('Se restauró tu copia local para que puedas revisarla antes de guardar.');
    },
    [
      currentSectionIndex,
      recoverableConflict,
      recoverableConflicts,
      sections,
      setCurrentSectionIndex,
      setDirtySectionKeys,
      setErrorSectionKey,
      setFormData,
      setHasUnsavedChanges,
      setSaveStatus,
    ],
  );

  const handleDismissRecoverableConflict = useCallback(
    (sectionKey?: string) => {
      const targetConflict = sectionKey
        ? recoverableConflicts.find((conflict) => conflict.sectionKey === sectionKey)
        : recoverableConflict;
      if (!targetConflict || !userId) return;

      clearEncounterSectionConflict(id, userId, targetConflict.sectionKey);
      setRecoverableConflicts((current) =>
        current.filter((conflict) => conflict.sectionKey !== targetConflict.sectionKey),
      );
      setRecoverableConflict((current) =>
        current?.sectionKey === targetConflict.sectionKey
          ? recoverableConflicts.find(
              (conflict) => conflict.sectionKey !== targetConflict.sectionKey,
            ) ?? null
          : current,
      );
      notify.success('Se descartó la copia local en conflicto.');
    },
    [id, recoverableConflict, recoverableConflicts, userId],
  );

  return {
    recoverableConflicts,
    recoverableConflict,
    setRecoverableConflicts,
    setRecoverableConflict,
    handleRestoreRecoverableConflict,
    handleDismissRecoverableConflict,
  };
}
