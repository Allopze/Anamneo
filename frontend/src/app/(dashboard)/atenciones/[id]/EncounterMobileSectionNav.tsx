'use client';

import clsx from 'clsx';
import { SECTION_STATUS_META } from './encounter-wizard.constants';
import type { Encounter } from '@/types';

type SectionNavItem = NonNullable<Encounter['sections']>[number];

type Props = {
  sections: SectionNavItem[];
  currentSectionIndex: number;
  getSectionUiState: (section: SectionNavItem) => keyof typeof SECTION_STATUS_META;
  moveToSection: (index: number) => void;
};

export default function EncounterMobileSectionNav({
  sections,
  currentSectionIndex,
  getSectionUiState,
  moveToSection,
}: Props) {
  return (
    <div className="xl:hidden">
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sidebar-scroll" aria-label="Secciones">
        {sections.map((section, index) => {
          const state = getSectionUiState(section);
          const meta = SECTION_STATUS_META[state];
          const isActive = index === currentSectionIndex;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => moveToSection(index)}
              className={clsx(
                'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-accent/40 bg-accent/10 text-ink'
                  : 'border-surface-muted/45 bg-surface-elevated text-ink-secondary hover:border-accent/30 hover:text-ink',
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dotClassName)} />
              <span className="whitespace-nowrap">
                {index + 1}. {section.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
