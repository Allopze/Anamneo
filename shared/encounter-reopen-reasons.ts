export const ENCOUNTER_REOPEN_REASON_CODES = [
  'CORRECCION_CLINICA',
  'RESULTADOS_POSTERIORES',
  'ERROR_DOCUMENTACION',
  'AJUSTE_PLAN',
  'SOLICITUD_PACIENTE',
  'OTRO',
] as const;

export type EncounterReopenReasonCode = (typeof ENCOUNTER_REOPEN_REASON_CODES)[number];

export const ENCOUNTER_REOPEN_REASON_LABELS: Record<EncounterReopenReasonCode, string> = {
  CORRECCION_CLINICA: 'Corrección clínica',
  RESULTADOS_POSTERIORES: 'Resultados posteriores',
  ERROR_DOCUMENTACION: 'Error de documentación',
  AJUSTE_PLAN: 'Ajuste del plan',
  SOLICITUD_PACIENTE: 'Solicitud del paciente',
  OTRO: 'Otro motivo clínico u operativo',
};
