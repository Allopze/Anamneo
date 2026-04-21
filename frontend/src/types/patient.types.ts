// Patient types
export type PatientSexo = 'MASCULINO' | 'FEMENINO' | 'OTRO' | 'PREFIERE_NO_DECIR';
export type PatientPrevision = 'FONASA' | 'ISAPRE' | 'OTRA' | 'DESCONOCIDA';
export type PatientRegistrationMode = 'COMPLETO' | 'RAPIDO';
export type PatientCompletenessStatus = 'INCOMPLETA' | 'PENDIENTE_VERIFICACION' | 'VERIFICADA';
export type PatientDemographicMissingField = 'rut' | 'edad' | 'sexo' | 'prevision';

export interface Patient {
  id: string;
  rut: string | null;
  rutExempt: boolean;
  rutExemptReason: string | null;
  nombre: string;
  fechaNacimiento: string | null;
  edad: number | null;
  edadMeses?: number | null;
  sexo: PatientSexo | null;
  trabajo: string | null;
  prevision: PatientPrevision | null;
  registrationMode: PatientRegistrationMode;
  completenessStatus: PatientCompletenessStatus;
  demographicsVerifiedAt?: string | null;
  demographicsVerifiedById?: string | null;
  demographicsMissingFields: PatientDemographicMissingField[];
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  archivedAt?: string | null;
  archivedById?: string | null;
  centroMedico: string | null;
  createdAt: string;
  updatedAt: string;
  history?: PatientHistory;
  encounters?: import('./encounter.types').Encounter[];
  problems?: PatientProblem[];
  tasks?: PatientTask[];
  _count?: {
    encounters: number;
  };
}

export interface PatientHistory {
  id: string;
  patientId: string;
  antecedentesMedicos: any;
  antecedentesQuirurgicos: any;
  antecedentesGinecoobstetricos: any;
  antecedentesFamiliares: any;
  habitos: any;
  medicamentos: any;
  alergias: any;
  inmunizaciones: any;
  antecedentesSociales: any;
  antecedentesPersonales: any;
  updatedAt: string;
}

export interface PatientProblem {
  id: string;
  patientId: string;
  encounterId?: string | null;
  medicoId?: string | null;
  label: string;
  status: 'ACTIVO' | 'CRONICO' | 'EN_ESTUDIO' | 'RESUELTO';
  notes?: string | null;
  severity?: string | null;
  onsetDate?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  encounter?: {
    id: string;
    createdAt: string;
    status: string;
  } | null;
}

export interface PatientTask {
  id: string;
  patientId: string;
  encounterId?: string | null;
  medicoId?: string | null;
  recurrenceSourceTaskId?: string | null;
  title: string;
  details?: string | null;
  type: 'SEGUIMIENTO' | 'EXAMEN' | 'DERIVACION' | 'TRAMITE';
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';
  recurrenceRule?: 'NONE' | 'WEEKLY' | 'MONTHLY';
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  createdBy?: {
    id: string;
    nombre: string;
  };
  patient?: Pick<Patient, 'id' | 'nombre' | 'rut'>;
}

export const TASK_PRIORITY_LABELS: Record<PatientTask['priority'], string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

export interface PatientClinicalSummary {
  patientId: string;
  generatedAt: string;
  counts: {
    totalEncounters: number;
    activeProblems: number;
    pendingTasks: number;
  };
  latestEncounterSummary: {
    encounterId: string;
    createdAt: string;
    lines: string[];
  } | null;
  vitalTrend: Array<{
    encounterId: string;
    createdAt: string;
    presionArterial: string | null;
    peso: number | null;
    imc: number | null;
    temperatura: number | null;
    saturacionOxigeno: number | null;
  }>;
  recentDiagnoses: Array<{
    label: string;
    count: number;
    lastSeenAt: string;
  }>;
  activeProblems: Array<{
    id: string;
    label: string;
    status: string;
    severity?: string | null;
    updatedAt: string;
  }>;
  pendingTasks: Array<{
    id: string;
    title: string;
    status: string;
    type: string;
    dueDate?: string | null;
    createdAt: string;
  }>;
}

export interface PatientAdminSummary {
  id: string;
  rut: string | null;
  rutExempt: boolean;
  rutExemptReason: string | null;
  nombre: string;
  fechaNacimiento: string | null;
  edad: number | null;
  edadMeses?: number | null;
  sexo: PatientSexo | null;
  trabajo: string | null;
  prevision: PatientPrevision | null;
  registrationMode: PatientRegistrationMode;
  completenessStatus: PatientCompletenessStatus;
  demographicsVerifiedAt?: string | null;
  demographicsVerifiedById?: string | null;
  demographicsMissingFields: PatientDemographicMissingField[];
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  centroMedico: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    nombre: string;
    email: string;
  } | null;
  metrics: {
    encounterCount: number;
    lastEncounterAt: string | null;
  };
}

export interface PatientOperationalHistoryItem {
  id: string;
  timestamp: string;
  reason: 'PATIENT_ARCHIVED' | 'PATIENT_RESTORED' | 'ENCOUNTER_CANCELLED' | 'ENCOUNTER_REOPENED';
  label: string;
  detail: string | null;
  userName: string;
  encounterId: string | null;
  encounterCreatedAt: string | null;
}

// Patient labels
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
