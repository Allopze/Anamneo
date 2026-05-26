export const ENCOUNTER_SECTION_CONFIG_KEY = 'encounter.sections.config.v1';

export const ENCOUNTER_SECTION_KEYS = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'ANAMNESIS_PROXIMA',
  'ANAMNESIS_REMOTA',
  'REVISION_SISTEMAS',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
  'RESPUESTA_TRATAMIENTO',
  'OBSERVACIONES',
] as const;

export type EncounterSectionConfigKey = (typeof ENCOUNTER_SECTION_KEYS)[number];

export type EncounterSectionConfigItem = {
  key: EncounterSectionConfigKey;
  enabled: boolean;
  requiredForCompletion: boolean;
  order: number;
  label: string;
};

export type EncounterSectionConfig = {
  sections: EncounterSectionConfigItem[];
};

export const DEFAULT_ENCOUNTER_SECTION_CONFIG: EncounterSectionConfig = {
  sections: [
    { key: 'IDENTIFICACION', enabled: true, requiredForCompletion: true, order: 10, label: 'Identificación del paciente' },
    { key: 'MOTIVO_CONSULTA', enabled: true, requiredForCompletion: true, order: 20, label: 'Motivo de consulta' },
    { key: 'ANAMNESIS_PROXIMA', enabled: true, requiredForCompletion: false, order: 30, label: 'Anamnesis próxima' },
    { key: 'ANAMNESIS_REMOTA', enabled: true, requiredForCompletion: false, order: 40, label: 'Anamnesis remota' },
    { key: 'REVISION_SISTEMAS', enabled: true, requiredForCompletion: false, order: 50, label: 'Revisión por sistemas' },
    { key: 'EXAMEN_FISICO', enabled: true, requiredForCompletion: true, order: 60, label: 'Examen físico' },
    { key: 'SOSPECHA_DIAGNOSTICA', enabled: true, requiredForCompletion: true, order: 70, label: 'Sospecha diagnóstica' },
    { key: 'TRATAMIENTO', enabled: true, requiredForCompletion: true, order: 80, label: 'Tratamiento' },
    { key: 'RESPUESTA_TRATAMIENTO', enabled: true, requiredForCompletion: false, order: 90, label: 'Respuesta al tratamiento' },
    { key: 'OBSERVACIONES', enabled: true, requiredForCompletion: false, order: 100, label: 'Observaciones' },
  ],
};

const SECTION_KEY_SET = new Set<string>(ENCOUNTER_SECTION_KEYS);
const DEFAULT_BY_KEY = new Map(DEFAULT_ENCOUNTER_SECTION_CONFIG.sections.map((section) => [section.key, section]));

export function normalizeEncounterSectionConfig(input: unknown): EncounterSectionConfig {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { sections?: unknown }).sections)) {
    return DEFAULT_ENCOUNTER_SECTION_CONFIG;
  }

  const seen = new Set<string>();
  const normalized = (input as { sections: unknown[] }).sections
    .map((raw) => {
      if (!raw || typeof raw !== 'object') {
        return null;
      }
      const record = raw as Partial<EncounterSectionConfigItem>;
      if (!record.key || !SECTION_KEY_SET.has(record.key)) {
        return null;
      }
      if (seen.has(record.key)) {
        return null;
      }
      seen.add(record.key);
      const fallback = DEFAULT_BY_KEY.get(record.key)!;
      return {
        key: record.key,
        enabled: typeof record.enabled === 'boolean' ? record.enabled : fallback.enabled,
        requiredForCompletion: typeof record.requiredForCompletion === 'boolean'
          ? record.requiredForCompletion
          : fallback.requiredForCompletion,
        order: Number.isFinite(Number(record.order)) ? Number(record.order) : fallback.order,
        label: typeof record.label === 'string' && record.label.trim()
          ? record.label.trim().slice(0, 80)
          : fallback.label,
      };
    })
    .filter((section): section is EncounterSectionConfigItem => section !== null);

  for (const section of DEFAULT_ENCOUNTER_SECTION_CONFIG.sections) {
    if (!seen.has(section.key)) {
      normalized.push(section);
    }
  }

  return {
    sections: normalized.sort((left, right) => left.order - right.order),
  };
}

export function getEnabledEncounterSectionKeys(config: EncounterSectionConfig) {
  return config.sections.filter((section) => section.enabled).map((section) => section.key);
}

export function getRequiredEncounterSectionKeys(config: EncounterSectionConfig) {
  return config.sections
    .filter((section) => section.enabled && section.requiredForCompletion)
    .map((section) => section.key);
}
