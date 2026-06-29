import type { EncounterSectionConfig } from '../../../shared/encounter-section-config';
import { getEnabledEncounterSectionKeys } from '../../../shared/encounter-section-config';

export interface FormatEncounterResponseOptions {
  viewerRole?: string;
  sectionConfig?: EncounterSectionConfig;
}

export function formatProgress(
  sections: Array<{ completed: boolean; sectionKey?: string }>,
  sectionConfig?: EncounterSectionConfig,
) {
  const enabledKeys = sectionConfig ? new Set(getEnabledEncounterSectionKeys(sectionConfig)) : null;
  const visibleSections = enabledKeys
    ? sections.filter((section) => section.sectionKey && enabledKeys.has(section.sectionKey as any))
    : sections;
  return {
    completed: visibleSections.filter((section) => section.completed).length,
    total: visibleSections.length,
  };
}

export function formatEpisodeSummary(episode: any) {
  if (!episode) {
    return null;
  }

  return {
    id: episode.id,
    label: episode.label,
    normalizedLabel: episode.normalizedLabel,
    startDate: episode.startDate ?? null,
    endDate: episode.endDate ?? null,
    isActive: episode.isActive,
  };
}
