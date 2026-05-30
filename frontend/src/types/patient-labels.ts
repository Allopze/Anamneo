import type {
  PatientCompletenessStatus,
  PatientDemographicMissingField,
  PatientRegistrationMode,
  PatientTask,
} from './patient.types';

export const TASK_PRIORITY_LABELS: Record<PatientTask['priority'], string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

export const SEXO_LABELS: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
  PREFIERE_NO_DECIR: 'Prefiere no decir',
};

export const PREVISION_LABELS: Record<string, string> = {
  FONASA: 'FONASA',
  ISAPRE: 'ISAPRE',
  OTRA: 'Otra',
  DESCONOCIDA: 'Desconocida',
};

export const PATIENT_REGISTRATION_MODE_LABELS: Record<PatientRegistrationMode, string> = {
  COMPLETO: 'Registro completo',
  RAPIDO: 'Alta rápida',
};

export const PATIENT_COMPLETENESS_STATUS_LABELS: Record<PatientCompletenessStatus, string> = {
  INCOMPLETA: 'Ficha incompleta',
  PENDIENTE_VERIFICACION: 'Pendiente de verificación médica',
  VERIFICADA: 'Ficha verificada',
};

export const PATIENT_DEMOGRAPHIC_FIELD_LABELS: Record<PatientDemographicMissingField, string> = {
  rut: 'RUT',
  edad: 'edad',
  sexo: 'sexo',
  prevision: 'previsión',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  SEGUIMIENTO: 'Seguimiento',
  EXAMEN: 'Examen',
  DERIVACION: 'Derivación',
  TRAMITE: 'Trámite',
};

export const TASK_RECURRENCE_LABELS: Record<'NONE' | 'WEEKLY' | 'MONTHLY', string> = {
  NONE: 'Sin recurrencia',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
};

export const PROBLEM_STATUS_LABELS: Record<string, string> = {
  ACTIVO: 'Activo',
  CRONICO: 'Crónico',
  EN_ESTUDIO: 'En estudio',
  RESUELTO: 'Resuelto',
};
