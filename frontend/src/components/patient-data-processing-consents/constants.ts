export const PURPOSES = [
  { value: 'ATENCION_CLINICA', label: 'Atención clínica (obligatorio)' },
  { value: 'ANALITICA_INTERNA', label: 'Analítica interna' },
  { value: 'COMUNICACIONES', label: 'Comunicaciones no esenciales' },
  { value: 'INVESTIGACION', label: 'Investigación' },
] as const;

export const METHODS = [
  { value: 'PRESENCIAL_TABLET', label: 'Presencial (tablet)' },
  { value: 'WEB_TITULAR', label: 'Web (titular)' },
  { value: 'REPRESENTANTE', label: 'Vía representante' },
] as const;

export const SIGNER_RELATIONSHIPS = [
  { value: 'TITULAR', label: 'Titular' },
  { value: 'PADRE', label: 'Padre' },
  { value: 'MADRE', label: 'Madre' },
  { value: 'TUTOR', label: 'Tutor legal' },
  { value: 'REPRESENTANTE', label: 'Otro representante legal' },
] as const;

export const REVOKE_CHANNELS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'WEB_TITULAR', label: 'Web (titular)' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'DPO', label: 'Vía DPO' },
] as const;

export const MIN_REVOKE_REASON_LENGTH = 20;
