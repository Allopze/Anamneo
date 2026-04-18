import { PATIENT_COMPLETENESS_STATUS_LABELS, PatientCompletenessStatus } from '@/types';

export const SEXO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMENINO', label: 'Femenino' },
  { value: 'OTRO', label: 'Otro' },
  { value: 'PREFIERE_NO_DECIR', label: 'Prefiere no decir' },
];

export const PREVISION_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'FONASA', label: 'Fonasa' },
  { value: 'ISAPRE', label: 'Isapre' },
  { value: 'OTRA', label: 'Otra' },
  { value: 'DESCONOCIDA', label: 'Desconocida' },
];

export const COMPLETENESS_OPTIONS: Array<{ value: '' | PatientCompletenessStatus; label: string }> = [
  { value: '', label: 'Todas las fichas' },
  { value: 'INCOMPLETA', label: PATIENT_COMPLETENESS_STATUS_LABELS.INCOMPLETA },
  { value: 'PENDIENTE_VERIFICACION', label: PATIENT_COMPLETENESS_STATUS_LABELS.PENDIENTE_VERIFICACION },
  { value: 'VERIFICADA', label: PATIENT_COMPLETENESS_STATUS_LABELS.VERIFICADA },
];

export const TASK_WINDOW_OPTIONS = [
  { value: '', label: 'Todos los seguimientos' },
  { value: 'OVERDUE', label: 'Vencidos' },
  { value: 'TODAY', label: 'Vencen hoy' },
  { value: 'THIS_WEEK', label: 'Vencen esta semana' },
  { value: 'NO_DUE_DATE', label: 'Sin fecha' },
];

export const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Fecha de registro' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'edad', label: 'Edad' },
  { value: 'updatedAt', label: 'Última actualización' },
];

export interface PatientFilters {
  sexo: string;
  prevision: string;
  completenessStatus: string;
  taskWindow: string;
  edadMin: string;
  edadMax: string;
  clinicalSearch: string;
  sortBy: string;
  sortOrder: string;
}
