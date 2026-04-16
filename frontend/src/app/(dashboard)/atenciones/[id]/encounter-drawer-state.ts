import type { SidebarTabKey } from '@/components/EncounterDrawer';

const ENCOUNTER_DRAWER_OPEN_KEY = 'anamneo:encounter-drawer-open';
const ENCOUNTER_DRAWER_TAB_KEY = 'anamneo:encounter-drawer-tab';

export function getInitialEncounterDrawerTab(): SidebarTabKey {
  if (typeof window === 'undefined') {
    return 'revision';
  }

  const stored = localStorage.getItem(ENCOUNTER_DRAWER_TAB_KEY);
  if (stored === 'revision' || stored === 'apoyo' || stored === 'cierre' || stored === 'historial') {
    return stored;
  }

  return 'revision';
}

export function getInitialEncounterDrawerOpen(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(ENCOUNTER_DRAWER_OPEN_KEY) === '1';
}

export function setEncounterDrawerOpen(next: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(ENCOUNTER_DRAWER_OPEN_KEY, next ? '1' : '0');
}

export function setEncounterDrawerTab(tab: SidebarTabKey) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(ENCOUNTER_DRAWER_TAB_KEY, tab);
}