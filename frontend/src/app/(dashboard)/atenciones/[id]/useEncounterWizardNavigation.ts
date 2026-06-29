import { useCallback, useEffect, useState } from 'react';
import type { WorkspacePanelKey } from '@/components/encounter-workspace.constants';
import type { Encounter, SectionKey } from '@/types';

type PersistSectionResult = 'noop' | 'saved' | 'queued';

interface UseEncounterWizardNavigationParams {
  canEdit: boolean;
  currentSectionIndex: number;
  currentSection?: NonNullable<Encounter['sections']>[number];
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  saveCurrentSection: () => Promise<void>;
  persistSection: (params?: { sectionKey?: SectionKey; completed?: boolean }) => Promise<PersistSectionResult>;
  sections: NonNullable<Encounter['sections']>;
  setCurrentSectionIndex: React.Dispatch<React.SetStateAction<number>>;
  startSectionTransition: React.TransitionStartFunction;
}

export function useEncounterWizardNavigation(params: UseEncounterWizardNavigationParams) {
  const {
    canEdit,
    currentSectionIndex,
    currentSection,
    hasUnsavedChanges,
    isSaving,
    saveCurrentSection,
    persistSection,
    sections,
    setCurrentSectionIndex,
    startSectionTransition,
  } = params;

  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<WorkspacePanelKey | null>(null);
  const [railCompletedCollapsed, setRailCompletedCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('anamneo:encounter-rail-collapsed') === '1';
  });

  const moveToSection = useCallback(
    async (nextIndex: number) => {
      if (isSaving || nextIndex === currentSectionIndex) return;

      try {
        await saveCurrentSection();
      } catch {
        return;
      }

      startSectionTransition(() => setCurrentSectionIndex(nextIndex));
    },
    [currentSectionIndex, isSaving, saveCurrentSection, setCurrentSectionIndex, startSectionTransition],
  );

  const handleNavigate = useCallback(
    async (direction: 'prev' | 'next') => {
      if (isSaving) return;

      if (direction === 'prev' && currentSectionIndex > 0) {
        await moveToSection(currentSectionIndex - 1);
        return;
      }

      if (direction === 'next' && currentSectionIndex < sections.length - 1) {
        try {
          if (canEdit && currentSection && !currentSection.completed && !currentSection.notApplicable) {
            await persistSection({ sectionKey: currentSection.sectionKey, completed: true });
          } else {
            await saveCurrentSection();
          }
        } catch {
          return;
        }

        startSectionTransition(() => setCurrentSectionIndex(currentSectionIndex + 1));
      }
    },
    [canEdit, currentSection, currentSectionIndex, isSaving, moveToSection, persistSection, saveCurrentSection, sections.length, setCurrentSectionIndex, startSectionTransition],
  );

  const openWorkspacePanel = useCallback((tab: WorkspacePanelKey) => {
    setActiveWorkspacePanel((current) => (current === tab ? null : tab));
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (event.key === 's') {
        event.preventDefault();
        void saveCurrentSection();
      } else if (event.key === 'ArrowLeft' && currentSectionIndex > 0) {
        event.preventDefault();
        void moveToSection(currentSectionIndex - 1);
      } else if (event.key === 'ArrowRight' && currentSectionIndex < sections.length - 1) {
        event.preventDefault();
        void handleNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSectionIndex, handleNavigate, moveToSection, saveCurrentSection, sections.length]);

  return {
    activeWorkspacePanel,
    setActiveWorkspacePanel,
    railCompletedCollapsed,
    setRailCompletedCollapsed,
    railCollapsed,
    setRailCollapsed,
    moveToSection,
    handleNavigate,
    openWorkspacePanel,
  };
}
