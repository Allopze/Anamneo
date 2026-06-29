import { useEffect, useRef } from 'react';

interface UseEncounterAutosaveParams {
  canEdit: boolean;
  hasUnsavedChanges: boolean;
  isDraftHydrated: boolean;
  saveCurrentSection: () => Promise<unknown>;
}

export function useEncounterAutosave(params: UseEncounterAutosaveParams) {
  const { canEdit, hasUnsavedChanges, isDraftHydrated, saveCurrentSection } = params;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canEdit || !isDraftHydrated) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      return;
    }

    if (hasUnsavedChanges) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => saveCurrentSection(), 10000);
    }

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [canEdit, hasUnsavedChanges, isDraftHydrated, saveCurrentSection]);
}
