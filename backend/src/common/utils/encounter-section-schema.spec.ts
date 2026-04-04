import {
  assertEncounterSectionSchemaRegistryIntegrity,
  ENCOUNTER_SECTION_SCHEMA_REGISTRY,
} from './encounter-section-schema';

describe('encounter-section-schema', () => {
  it('keeps every section in the registry with a valid version chain', () => {
    expect(() => assertEncounterSectionSchemaRegistryIntegrity()).not.toThrow();
  });

  it('fails fast when a version bump is missing an upgrader', () => {
    const brokenRegistry = {
      ...ENCOUNTER_SECTION_SCHEMA_REGISTRY,
      MOTIVO_CONSULTA: {
        currentVersion: 2,
      },
    };

    expect(() =>
      assertEncounterSectionSchemaRegistryIntegrity(brokenRegistry as typeof ENCOUNTER_SECTION_SCHEMA_REGISTRY),
    ).toThrow('MOTIVO_CONSULTA');
  });
});
