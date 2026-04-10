import { SectionKey } from '../types';
import { getEncounterSectionSchemaDefinition } from './encounter-section-schema';
import { parseStoredJson } from './encounter-sections';

export function upgradeEncounterSectionData(params: {
  sectionKey: SectionKey;
  data: unknown;
  schemaVersion?: number | null;
}) {
  const { sectionKey } = params;
  const data = parseStoredJson<Record<string, unknown>>(params.data, {});
  const schemaDefinition = getEncounterSectionSchemaDefinition(sectionKey);

  // Keep reads resilient when older or unexpected section keys are present in storage.
  if (!schemaDefinition) {
    return {
      data,
      schemaVersion: Math.max(1, params.schemaVersion ?? 1),
    };
  }

  const targetVersion = schemaDefinition.currentVersion;
  const initialVersion = Math.max(1, params.schemaVersion ?? 1);

  if (initialVersion > targetVersion) {
    throw new Error(
      `Encounter section ${sectionKey} schemaVersion ${initialVersion} is newer than supported version ${targetVersion}`,
    );
  }

  let currentVersion = initialVersion;
  let currentData = data;

  while (currentVersion < targetVersion) {
    const upgrader = schemaDefinition.upgraders?.[currentVersion];
    if (!upgrader) {
      throw new Error(
        `Missing encounter section upgrader for ${sectionKey} schemaVersion ${currentVersion} -> ${currentVersion + 1}`,
      );
    }

    currentData = upgrader(currentData);
    currentVersion += 1;
  }

  const normalizer = schemaDefinition.normalizeReadData;
  currentData = normalizer ? normalizer(currentData) : currentData;

  return {
    data: currentData,
    schemaVersion: targetVersion,
  };
}

export function formatEncounterSectionForRead<T extends {
  sectionKey: string;
  data: unknown;
  schemaVersion?: number | null;
}>(section: T) {
  const upgraded = upgradeEncounterSectionData({
    sectionKey: section.sectionKey as SectionKey,
    data: section.data,
    schemaVersion: section.schemaVersion,
  });

  return {
    ...section,
    data: upgraded.data,
    schemaVersion: upgraded.schemaVersion,
  };
}
