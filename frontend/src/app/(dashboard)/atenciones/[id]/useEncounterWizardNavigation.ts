import { useCallback, useEffect, useState } from 'react';
import { setEncounterDrawerOpen, setEncounterDrawerTab, getInitialEncounterDrawerOpen, getInitialEncounterDrawerTab } from './encounter-drawer-state';
import type { SidebarTabKey } from '@/components/EncounterDrawer';
import type { Encounter, SectionKey } from '@/types';

interface UseEncounterWizardNavigationParams {
  canEdit: boolean;
  currentSectionIndex: number;
  currentSection?: NonNullable<Encounter['sections']>[number];
  hasUnsavedChanges: boolean;
  saveCurrentSection: () => void;
  persistSection: (params?: { sectionKey?: SectionKey; completed?: boolean }) => Promise<void>;
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
    saveCurrentSection,
    persistSection,
    sections,
    setCurrentSectionIndex,
    startSectionTransition,
  } = params;

  const [sidebarTab, setSidebarTab] = useState<SidebarTabKey>(getInitialEncounterDrawerTab);
  const [isDrawerOpen, setIsDrawerOpen] = useState(getInitialEncounterDrawerOpen);
  const [railCompletedCollapsed, setRailCompletedCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('anamneo:encounter-rail-collapsed') === '1';
  });

  const moveToSection = useCallback(
    (nextIndex: number) => {
      saveCurrentSection();
      startSectionTransition(() => setCurrentSectionIndex(nextIndex));
    },
    [saveCurrentSection, setCurrentSectionIndex, startSectionTransition],
  );

  const handleNavigate = useCallback(
    async (direction: 'prev' | 'next') => {
      if (direction === 'prev' && currentSectionIndex > 0) {
        moveToSection(currentSectionIndex - 1);
        return;
      }

      if (direction === 'next' && currentSectionIndex < sections.length - 1) {
        if (canEdit && currentSection && !currentSection.completed && !currentSection.notApplicable) {
          void persistSection({ sectionKey: currentSection.sectionKey, completed: true });
        } else {
          saveCurrentSection();
        }

        startSectionTransition(() => setCurrentSectionIndex(currentSectionIndex + 1));
      }
    },
    [canEdit, currentSection, currentSectionIndex, moveToSection, persistSection, saveCurrentSection, sections.length, setCurrentSectionIndex, startSectionTransition],
  );

  const openDrawerTab = useCallback((tab: SidebarTabKey) => {
    setSidebarTab(tab);
    setEncounterDrawerTab(tab);
    setIsDrawerOpen(true);
    setEncounterDrawerOpen(true);
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
        saveCurrentSection();
      } else if (event.key === '.') {
        event.preventDefault();
        setIsDrawerOpen((previous) => {
          const next = !previous;
          setEncounterDrawerOpen(next);
          return next;
        });
      } else if (event.key === 'ArrowLeft' && currentSectionIndex > 0) {
        event.preventDefault();
        saveCurrentSection();
        startSectionTransition(() => setCurrentSectionIndex((index) => index - 1));
      } else if (event.key === 'ArrowRight' && currentSectionIndex < sections.length - 1) {
        event.preventDefault();
        saveCurrentSection();
        startSectionTransition(() => setCurrentSectionIndex((index) => index + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSectionIndex, saveCurrentSection, sections.length, setCurrentSectionIndex, startSectionTransition]);

  return {
    sidebarTab,
    setSidebarTab,
    isDrawerOpen,
    setIsDrawerOpen,
    railCompletedCollapsed,
    setRailCompletedCollapsed,
    railCollapsed,
    setRailCollapsed,
    moveToSection,
    handleNavigate,
    openDrawerTab,
  };
}