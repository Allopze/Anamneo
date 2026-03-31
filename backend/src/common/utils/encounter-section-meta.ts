import { SectionKey } from '../types';

export const ENCOUNTER_SECTION_ORDER: SectionKey[] = [
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
];

export const ENCOUNTER_SECTION_LABELS: Record<SectionKey, string> = {
  IDENTIFICACION: 'Identificación del paciente',
  MOTIVO_CONSULTA: 'Motivo de consulta',
  ANAMNESIS_PROXIMA: 'Anamnesis próxima',
  ANAMNESIS_REMOTA: 'Anamnesis remota',
  REVISION_SISTEMAS: 'Revisión por sistemas',
  EXAMEN_FISICO: 'Examen físico',
  SOSPECHA_DIAGNOSTICA: 'Sospecha diagnóstica',
  TRATAMIENTO: 'Tratamiento',
  RESPUESTA_TRATAMIENTO: 'Respuesta al tratamiento',
  OBSERVACIONES: 'Observaciones',
};

export const ENCOUNTER_SECTION_SCHEMA_VERSIONS: Record<SectionKey, number> = {
  IDENTIFICACION: 1,
  MOTIVO_CONSULTA: 1,
  ANAMNESIS_PROXIMA: 1,
  ANAMNESIS_REMOTA: 1,
  REVISION_SISTEMAS: 1,
  EXAMEN_FISICO: 1,
  SOSPECHA_DIAGNOSTICA: 1,
  TRATAMIENTO: 1,
  RESPUESTA_TRATAMIENTO: 1,
  OBSERVACIONES: 2,
};

export function getEncounterSectionSchemaVersion(sectionKey: SectionKey) {
  return ENCOUNTER_SECTION_SCHEMA_VERSIONS[sectionKey];
}
