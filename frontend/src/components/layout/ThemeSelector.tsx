'use client';

import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';
import { useDashboardTheme } from './DashboardThemeProvider';

export function ThemeSelector() {
  const { theme, setTheme, options } = useDashboardTheme();

  return (
    <div
      className="theme-selector"
      role="group"
      aria-label="Selector de tema"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === theme;

        return (
          <Tooltip key={option.value} label={`Tema ${option.label.toLowerCase()}`} side="bottom">
            <button
              type="button"
              className={clsx('theme-selector-option', selected && 'theme-selector-option-active')}
              aria-label={`Tema ${option.label}`}
              aria-pressed={selected}
              onClick={() => setTheme(option.value)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{option.label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
