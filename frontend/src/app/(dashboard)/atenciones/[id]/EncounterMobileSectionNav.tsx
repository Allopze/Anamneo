'use client';

import { SECTION_STATUS_META } from './encounter-wizard.constants';
import type { Encounter } from '@/types';

type SectionNavItem = NonNullable<Encounter['sections']>[number];

type Props = {
  sections: SectionNavItem[];
  currentSectionIndex: number;
  completedCount: number;
  saveStateLabel: string | null;
  getSectionUiState: (section: SectionNavItem) => keyof typeof SECTION_STATUS_META;
  moveToSection: (index: number) => void;
};

export default function EncounterMobileSectionNav({
  sections,
  currentSectionIndex,
  completedCount,
  saveStateLabel,
  getSectionUiState,
  moveToSection,
}: Props) {
  const activeSection = sections[currentSectionIndex];
  const progressValue = sections.length > 0 ? (completedCount / sections.length) * 100 : 0;

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-surface-muted/40 bg-surface-base px-4 py-3 xl:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-secondary">
            {completedCount}/{sections.length} completas
          </p>
          <p className="truncate text-sm font-semibold text-ink">{activeSection?.label ?? 'Sección'}</p>
        </div>
        {saveStateLabel ? (
          <p className="shrink-0 text-xs font-medium text-ink-secondary" aria-live="polite">
            {saveStateLabel}
          </p>
        ) : null}
      </div>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-muted/55"
        role="progressbar"
        aria-label="Progreso de secciones completadas"
        aria-valuemin={0}
        aria-valuemax={sections.length}
        aria-valuenow={completedCount}
      >
        <div
          className="h-full rounded-full bg-frame transition-[width] duration-200"
          style={{ width: `${progressValue}%` }}
        />
      </div>

      <label className="sr-only" htmlFor="encounter-mobile-section-select">
        Cambiar sección
      </label>
      <select
        id="encounter-mobile-section-select"
        className="form-input mt-3 min-h-11 rounded-lg py-2 text-sm"
        value={currentSectionIndex}
        onChange={(event) => moveToSection(Number(event.target.value))}
        aria-label="Cambiar sección de la atención"
      >
        {sections.map((section, index) => {
          const state = getSectionUiState(section);
          const meta = SECTION_STATUS_META[state];
          const suffix = 'hidden' in meta && meta.hidden ? '' : `, ${meta.label}`;
          return (
            <option key={section.id} value={index}>
              {index + 1}. {section.label}{suffix}
            </option>
          );
        })}
      </select>
    </div>
  );
}
