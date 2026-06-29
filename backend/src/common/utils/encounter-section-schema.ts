import { SectionKey, SECTION_KEYS } from '../types';

type EncounterSectionData = Record<string, unknown>;

export type EncounterSectionUpgrader = (data: EncounterSectionData) => EncounterSectionData;

export type EncounterSectionSchemaDefinition = {
  currentVersion: number;
  upgraders?: Partial<Record<number, EncounterSectionUpgrader>>;
  normalizeReadData?: EncounterSectionUpgrader;
};

function normalizePerfilDolorAbdominal(data: EncounterSectionData) {
  const raw = data.perfilDolorAbdominal;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return data;
  }

  const record = raw as Record<string, unknown>;
  const normalized = {
    ...(typeof record.presente === 'boolean' ? { presente: record.presente } : {}),
    ...(typeof record.vomitos === 'boolean' ? { vomitos: record.vomitos } : {}),
    ...(typeof record.diarrea === 'boolean' ? { diarrea: record.diarrea } : {}),
    ...(typeof record.nauseas === 'boolean' ? { nauseas: record.nauseas } : {}),
    ...(typeof record.estrenimiento === 'boolean' ? { estrenimiento: record.estrenimiento } : {}),
    ...(typeof record.asociadoComida === 'string' ? { asociadoComida: record.asociadoComida } : {}),
    ...(typeof record.notas === 'string' ? { notas: record.notas } : {}),
  };

  return {
    ...data,
    ...(Object.keys(normalized).length > 0 ? { perfilDolorAbdominal: normalized } : {}),
  };
}

function normalizeRespuestaEstructurada(data: EncounterSectionData) {
  const raw = data.respuestaEstructurada;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return data;
  }

  const record = raw as Record<string, unknown>;
  const normalized = {
    ...(typeof record.estado === 'string' ? { estado: record.estado } : {}),
    ...(typeof record.notas === 'string' ? { notas: record.notas } : {}),
  };

  return {
    ...data,
    ...(Object.keys(normalized).length > 0 ? { respuestaEstructurada: normalized } : {}),
  };
}

function normalizeResultadosTratamientos(data: EncounterSectionData) {
  if (!Array.isArray(data.resultadosTratamientos)) {
    return data;
  }

  const normalized = data.resultadosTratamientos
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      ...(typeof item.treatmentItemId === 'string' ? { treatmentItemId: item.treatmentItemId } : {}),
      ...(typeof item.estado === 'string' ? { estado: item.estado } : {}),
      ...(typeof item.notas === 'string' ? { notas: item.notas } : {}),
      ...(typeof item.adherenceStatus === 'string' ? { adherenceStatus: item.adherenceStatus } : {}),
      ...(typeof item.adverseEventSeverity === 'string' ? { adverseEventSeverity: item.adverseEventSeverity } : {}),
      ...(typeof item.adverseEventNotes === 'string' ? { adverseEventNotes: item.adverseEventNotes } : {}),
    }))
    .filter((item) => typeof item.treatmentItemId === 'string' && item.treatmentItemId.length > 0);

  return {
    ...data,
    ...(normalized.length > 0 ? { resultadosTratamientos: normalized } : {}),
  };
}

export const ENCOUNTER_SECTION_SCHEMA_REGISTRY: Record<SectionKey, EncounterSectionSchemaDefinition> = {
  IDENTIFICACION: {
    currentVersion: 1,
  },
  MOTIVO_CONSULTA: {
    currentVersion: 1,
  },
  ANAMNESIS_PROXIMA: {
    currentVersion: 1,
    normalizeReadData: normalizePerfilDolorAbdominal,
  },
  ANAMNESIS_REMOTA: {
    currentVersion: 1,
  },
  REVISION_SISTEMAS: {
    currentVersion: 1,
  },
  EXAMEN_FISICO: {
    currentVersion: 1,
  },
  SOSPECHA_DIAGNOSTICA: {
    currentVersion: 1,
  },
  TRATAMIENTO: {
    currentVersion: 1,
  },
  RESPUESTA_TRATAMIENTO: {
    currentVersion: 1,
    normalizeReadData: (data) => normalizeResultadosTratamientos(normalizeRespuestaEstructurada(data)),
  },
  OBSERVACIONES: {
    currentVersion: 2,
    upgraders: {
      1: (data) => ({
        ...data,
        resumenClinico:
          typeof data.resumenClinico === 'string'
            ? data.resumenClinico
            : '',
      }),
    },
    normalizeReadData: (data) => ({
      ...data,
      resumenClinico:
        typeof data.resumenClinico === 'string'
          ? data.resumenClinico
          : '',
    }),
  },
};

export function getEncounterSectionSchemaDefinition(sectionKey: SectionKey) {
  return ENCOUNTER_SECTION_SCHEMA_REGISTRY[sectionKey];
}

export function getEncounterSectionSchemaVersion(sectionKey: SectionKey) {
  return getEncounterSectionSchemaDefinition(sectionKey).currentVersion;
}

export function assertEncounterSectionSchemaRegistryIntegrity(
  registry: Record<SectionKey, EncounterSectionSchemaDefinition> = ENCOUNTER_SECTION_SCHEMA_REGISTRY,
) {
  for (const sectionKey of SECTION_KEYS) {
    const definition = registry[sectionKey];

    if (!definition) {
      throw new Error(`Missing encounter section schema definition for ${sectionKey}`);
    }

    if (!Number.isInteger(definition.currentVersion) || definition.currentVersion < 1) {
      throw new Error(`Encounter section ${sectionKey} must define a valid currentVersion`);
    }

    for (let version = 1; version < definition.currentVersion; version += 1) {
      if (!definition.upgraders?.[version]) {
        throw new Error(
          `Encounter section ${sectionKey} is missing upgrader ${version} -> ${version + 1}`,
        );
      }
    }
  }
}

assertEncounterSectionSchemaRegistryIntegrity();
