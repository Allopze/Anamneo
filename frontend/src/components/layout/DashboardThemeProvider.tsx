'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FiBookOpen, FiMoon, FiSun } from 'react-icons/fi';

export type DashboardTheme = 'light' | 'editorial' | 'dark';

export const DASHBOARD_THEME_STORAGE_KEY = 'anamneo:dashboard-theme';

const DEFAULT_DASHBOARD_THEME: DashboardTheme = 'editorial';

const DASHBOARD_THEME_OPTIONS: Array<{ value: DashboardTheme; label: string; icon: IconType }> = [
  { value: 'light', label: 'Claro', icon: FiSun },
  { value: 'editorial', label: 'Editorial', icon: FiBookOpen },
  { value: 'dark', label: 'Oscuro', icon: FiMoon },
];

interface DashboardThemeContextValue {
  theme: DashboardTheme;
  setTheme: (theme: DashboardTheme) => void;
  options: Array<{ value: DashboardTheme; label: string; icon: IconType }>;
}

const DashboardThemeContext = createContext<DashboardThemeContextValue | null>(null);

function isDashboardTheme(value: string | null): value is DashboardTheme {
  return value === 'light' || value === 'editorial' || value === 'dark';
}

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DashboardTheme>(DEFAULT_DASHBOARD_THEME);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);

    if (isDashboardTheme(storedTheme)) {
      setThemeState(storedTheme);
      return;
    }

    if (storedTheme != null) {
      window.localStorage.removeItem(DASHBOARD_THEME_STORAGE_KEY);
    }
  }, []);

  const setTheme = useCallback((nextTheme: DashboardTheme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      options: DASHBOARD_THEME_OPTIONS,
    }),
    [setTheme, theme],
  );

  return (
    <DashboardThemeContext.Provider value={value}>
      {children}
    </DashboardThemeContext.Provider>
  );
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext);

  if (!context) {
    throw new Error('useDashboardTheme must be used within DashboardThemeProvider');
  }

  return context;
}
