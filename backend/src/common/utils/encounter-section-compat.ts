import { SectionKey } from '../types';
import { getEncounterSectionSchemaVersion } from './encounter-section-meta';
import { parseStoredJson } from './encounter-sections';

type EncounterSectionUpgradeMap = Partial<
  Record<SectionKey, Partial<Record<number, (data: Record<string, unknown>) => Record<string, unknown>>>>
>;

const ENCOUNTER_SECTION_UPGRADERS: EncounterSectionUpgradeMap = {
  OBSERVACIONES: {
    1: (data) => ({
      ...data,
      resumenClinico:
        typeof data.resumenClinico === 'string'
          ? data.resumenClinico
          : '',
    }),
  },
};

const ENCOUNTER_SECTION_READ_NORMALIZERS: Partial<
  Record<SectionKey, (data: Record<string, unknown>) => Record<string, unknown>>
> = {
  OBSERVACIONES: (data) => ({
    ...data,
    resumenClinico:
      typeof data.resumenClinico === 'string'
        ? data.resumenClinico
        : '',
  }),
};

export function upgradeEncounterSectionData(params: {
  sectionKey: SectionKey;
  data: unknown;
  schemaVersion?: number | null;
}) {
  const { sectionKey } = params;
  const data = parseStoredJson<Record<string, unknown>>(params.data, {});
  const targetVersion = getEncounterSectionSchemaVersion(sectionKey);
  const initialVersion = Math.max(1, params.schemaVersion ?? 1);

  if (initialVersion > targetVersion) {
    throw new Error(
      `Encounter section ${sectionKey} schemaVersion ${initialVersion} is newer than supported version ${targetVersion}`,
    );
  }

  let currentVersion = initialVersion;
  let currentData = data;

  while (currentVersion < targetVersion) {
    const upgrader = ENCOUNTER_SECTION_UPGRADERS[sectionKey]?.[currentVersion];
    if (!upgrader) {
      throw new Error(
        `Missing encounter section upgrader for ${sectionKey} schemaVersion ${currentVersion} -> ${currentVersion + 1}`,
      );
    }

    currentData = upgrader(currentData);
    currentVersion += 1;
  }

  const normalizer = ENCOUNTER_SECTION_READ_NORMALIZERS[sectionKey];
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
