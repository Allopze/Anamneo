// Local type definitions for SQLite compatibility
// SQLite doesn't support ENUMs, so we define them as string literal types

export type Role = 'MEDICO' | 'ASISTENTE' | 'ADMIN';

export type Sexo = 'MASCULINO' | 'FEMENINO' | 'OTRO' | 'PREFIERE_NO_DECIR';

export type Prevision = 'FONASA' | 'ISAPRE' | 'OTRA' | 'DESCONOCIDA';

export type EncounterStatus = 'EN_PROGRESO' | 'COMPLETADO' | 'CANCELADO';

export type SectionKey = 
  | 'IDENTIFICACION'
  | 'MOTIVO_CONSULTA'
  | 'ANAMNESIS_PROXIMA'
  | 'ANAMNESIS_REMOTA'
  | 'REVISION_SISTEMAS'
  | 'EXAMEN_FISICO'
  | 'SOSPECHA_DIAGNOSTICA'
  | 'TRATAMIENTO'
  | 'RESPUESTA_TRATAMIENTO'
  | 'OBSERVACIONES';

export type ChosenMode = 'AUTO' | 'MANUAL';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

// Enum values arrays for validation
export const ROLES = ['MEDICO', 'ASISTENTE', 'ADMIN'] as const;
export const SEXOS = ['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR'] as const;
export const PREVISIONES = ['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA'] as const;
export const ENCOUNTER_STATUSES = ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const;
export const SECTION_KEYS = [
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
export const CHOSEN_MODES = ['AUTO', 'MANUAL'] as const;
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
