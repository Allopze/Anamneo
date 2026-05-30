import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Encounter, SectionKey } from '@/types';

interface UseEncounterDirtyTrackerParams {
  canEdit: boolean;
  currentSection?: NonNullable<Encounter['sections']>[number];
  encounter?: Encounter;
  isDraftHydrated: boolean;
  sections: NonNullable<Encounter['sections']>;
  savedSnapshotJson: string;
  savedSnapshotDataRef: MutableRefObject<Record<string, any>>;
  formDataRef: MutableRefObject<Record<string, any>>;
  lastSavedRef: MutableRefObject<string>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setSavedSnapshotJson: React.Dispatch<React.SetStateAction<string>>;
  setErrorSectionKey: React.Dispatch<React.SetStateAction<SectionKey | null>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'saved' | 'queued' | 'error'>>;
}

/**
 * Tracks which sections have unsaved changes ("dirty" state).
 *
 * Responsibilities:
 *  - Maintains the `dirtySectionKeys` set.
 *  - Derives `hasUnsavedChanges` from the current section's dirty state.
 *  - Recomputes dirty keys when the saved snapshot or section list changes.
 *  - Keeps `savedSnapshotJson` in sync with server data when there are no
 *    local conflicts (server wins for clean sections).
 *  - Exposes `handleSectionDataChange` to update formData and dirty tracking
 *    together.
 */
export function useEncounterDirtyTracker({
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
}: UseEncounterDirtyTrackerParams) {
  const [dirtySectionKeys, setDirtySectionKeys] = useState<Set<SectionKey>>(() => new Set());

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
    [canEdit, savedSnapshotDataRef, setErrorSectionKey, setFormData, setSaveStatus],
  );

  // Derive hasUnsavedChanges from the current section's dirty flag.
  useEffect(() => {
    if (!currentSection || !isDraftHydrated) {
      setHasUnsavedChanges(false);
      return;
    }

    setHasUnsavedChanges(dirtySectionKeys.has(currentSection.sectionKey));
  }, [currentSection, dirtySectionKeys, isDraftHydrated, setHasUnsavedChanges]);

  // Recompute the full dirty set when saved snapshot or sections change.
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
  }, [formDataRef, isDraftHydrated, savedSnapshotDataRef, savedSnapshotJson, sections]);

  // Keep savedSnapshotJson in sync with server data for unmodified sections.
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

      if (!localMatchesServer) return;

      if (JSON.stringify(nextSnapshot[section.sectionKey]) !== JSON.stringify(serverData)) {
        nextSnapshot[section.sectionKey] = serverData;
        changed = true;
      }
    });

    if (!changed) return;

    lastSavedRef.current = JSON.stringify(nextSnapshot);
    setSavedSnapshotJson(lastSavedRef.current);
  }, [encounter?.sections, formDataRef, isDraftHydrated, lastSavedRef, setSavedSnapshotJson]);

  const dirtySectionKeyList = useMemo(() => [...dirtySectionKeys], [dirtySectionKeys]);

  return {
    dirtySectionKeys,
    dirtySectionKeyList,
    setDirtySectionKeys,
    handleSectionDataChange,
  };
}
