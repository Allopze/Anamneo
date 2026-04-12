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
  centroMedico: string | null;
  createdAt: string;
  updatedAt: string;
  history?: PatientHistory;
  encounters?: Encounter[];
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

// Encounter types
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

export interface EncounterSection {
  id: string;
  encounterId: string;
  sectionKey: SectionKey;
  schemaVersion: number;
  label: string;
  order: number;
  data: Record<string, any>;
  completed: boolean;
  notApplicable: boolean;
  notApplicableReason: string | null;
  updatedAt: string;
}

export interface EncounterIdentificationSnapshotStatus {
  isSnapshot: boolean;
  hasDifferences: boolean;
  differingFields: string[];
  differingFieldLabels: string[];
  snapshotCreatedAt: string;
  sourcePatientUpdatedAt?: string | null;
}

export const ENCOUNTER_CLINICAL_OUTPUT_ACTIONS = [
  'COMPLETE_ENCOUNTER',
  'EXPORT_OFFICIAL_DOCUMENTS',
  'PRINT_CLINICAL_RECORD',
] as const;

export type EncounterClinicalOutputAction = typeof ENCOUNTER_CLINICAL_OUTPUT_ACTIONS[number];

export interface EncounterClinicalOutputBlock {
  completenessStatus: Extract<PatientCompletenessStatus, 'INCOMPLETA' | 'PENDIENTE_VERIFICACION'>;
  missingFields: PatientDemographicMissingField[];
  blockedActions: EncounterClinicalOutputAction[];
  reason: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  createdById: string;
  status: 'EN_PROGRESO' | 'COMPLETADO' | 'FIRMADO' | 'CANCELADO';
  reviewStatus?: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO';
  reviewRequestedAt?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  closureNote?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  createdBy?: {
    id: string;
    nombre: string;
    email?: string;
  };
  reviewRequestedBy?: {
    id: string;
    nombre: string;
  } | null;
  reviewedBy?: {
    id: string;
    nombre: string;
  } | null;
  completedBy?: {
    id: string;
    nombre: string;
  } | null;
  sections?: EncounterSection[];
  attachments?: Attachment[];
  tasks?: PatientTask[];
  identificationSnapshotStatus?: EncounterIdentificationSnapshotStatus;
  clinicalOutputBlock?: EncounterClinicalOutputBlock | null;
  progress?: {
    completed: number;
    total: number;
  };
}

export interface SignEncounterResponse {
  signatureId: string;
  contentHash: string;
  signedAt: string;
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
  title: string;
  details?: string | null;
  type: 'SEGUIMIENTO' | 'EXAMEN' | 'DERIVACION' | 'TRAMITE';
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';
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

// Condition types
export interface Condition {
  id: string;
  name: string;
  synonyms: string[];
  tags: string[];
  active: boolean;
  scope?: 'GLOBAL' | 'LOCAL';
  baseConditionId?: string | null;
}

export interface ConditionSuggestion {
  id: string;
  name: string;
  score: number;
  confidence: number;
}

// Attachment types
export interface Attachment {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  category?: string | null;
  description?: string | null;
  linkedOrderType?: 'EXAMEN' | 'DERIVACION' | null;
  linkedOrderId?: string | null;
  linkedOrderLabel?: string | null;
  uploadedAt: string;
  uploadedBy?: {
    nombre: string;
  };
}

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

// ── Section data types (Q1) ──────────────────────────────────────────

export interface IdentificacionData {
  rut?: string;
  rutExempt?: boolean;
  rutExemptReason?: string;
  nombre?: string;
  edad?: number | null;
  edadMeses?: number | null;
  sexo?: string | null;
  trabajo?: string;
  prevision?: string | null;
  domicilio?: string;
  completenessStatus?: PatientCompletenessStatus;
  registrationMode?: PatientRegistrationMode;
  demographicsMissingFields?: PatientDemographicMissingField[];
}

export interface MotivoConsultaData {
  texto?: string;
  afeccionSeleccionada?: { id: string; name: string; confidence: number } | null;
  modoSeleccion?: 'AUTO' | 'MANUAL';
}

export interface AnamnesisProximaData {
  relatoAmpliado?: string;
  inicio?: string;
  evolucion?: string;
  factoresAgravantes?: string;
  factoresAtenuantes?: string;
  sintomasAsociados?: string;
}

export interface HistoryFieldValue {
  texto?: string;
  items?: string[];
}

export interface AnamnesisRemotaData {
  readonly?: boolean;
  antecedentesMedicos?: HistoryFieldValue | string;
  antecedentesQuirurgicos?: HistoryFieldValue | string;
  antecedentesGinecoobstetricos?: HistoryFieldValue | string;
  antecedentesFamiliares?: HistoryFieldValue | string;
  habitos?: HistoryFieldValue | string;
  medicamentos?: HistoryFieldValue | string;
  alergias?: HistoryFieldValue | string;
  inmunizaciones?: HistoryFieldValue | string;
  antecedentesSociales?: HistoryFieldValue | string;
  antecedentesPersonales?: HistoryFieldValue | string;
}

export interface SystemReviewItem {
  checked: boolean;
  notas: string;
}

export interface RevisionSistemasData {
  psiquico?: SystemReviewItem;
  cabeza?: SystemReviewItem;
  cuello?: SystemReviewItem;
  columna?: SystemReviewItem;
  musculoArticulaciones?: SystemReviewItem;
  piel?: SystemReviewItem;
  respiratorio?: SystemReviewItem;
  cardiovascular?: SystemReviewItem;
  gastrointestinal?: SystemReviewItem;
  genitourinario?: SystemReviewItem;
  neurologico?: SystemReviewItem;
  ginecologico?: SystemReviewItem;
}

export interface SignosVitales {
  presionArterial?: string;
  frecuenciaCardiaca?: string;
  frecuenciaRespiratoria?: string;
  temperatura?: string;
  saturacionOxigeno?: string;
  peso?: string;
  talla?: string;
  imc?: string;
}

export interface ExamenFisicoData {
  estadoGeneral?: string;
  estadoGeneralNotas?: string;
  signosVitales?: SignosVitales;
  cabeza?: string;
  cuello?: string;
  torax?: string;
  abdomen?: string;
  extremidades?: string;
}

export interface SospechaDiagnostica {
  id: string;
  diagnostico: string;
  codigoCie10?: string;
  descripcionCie10?: string;
  prioridad: number;
  notas: string;
}

export interface SospechaDiagnosticaData {
  sospechas?: SospechaDiagnostica[];
}

export interface TratamientoData {
  plan?: string;
  /** @deprecated Usar solo 'plan' */
  indicaciones?: string;
  receta?: string;
  examenes?: string;
  derivaciones?: string;
  medicamentosEstructurados?: StructuredMedication[];
  examenesEstructurados?: StructuredOrder[];
  derivacionesEstructuradas?: StructuredOrder[];
}

export interface RespuestaTratamientoData {
  evolucion?: string;
  resultadosExamenes?: string;
  ajustesTratamiento?: string;
  planSeguimiento?: string;
}

export interface ObservacionesData {
  observaciones?: string;
  notasInternas?: string;
  resumenClinico?: string;
}

export interface StructuredMedication {
  id: string;
  nombre: string;
  dosis?: string;
  via?: string;
  frecuencia?: string;
  duracion?: string;
  indicacion?: string;
}

export interface StructuredOrder {
  id: string;
  nombre: string;
  indicacion?: string;
  estado?: 'PENDIENTE' | 'RECIBIDO' | 'REVISADO';
  resultado?: string;
}

/** Union of all section data shapes */
export type SectionData =
  | IdentificacionData
  | MotivoConsultaData
  | AnamnesisProximaData
  | AnamnesisRemotaData
  | RevisionSistemasData
  | ExamenFisicoData
  | SospechaDiagnosticaData
  | TratamientoData
  | RespuestaTratamientoData
  | ObservacionesData;

// Section labels mapping
export const SECTION_LABELS: Record<SectionKey, string> = {
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

// Sex labels
export const SEXO_LABELS: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
  PREFIERE_NO_DECIR: 'Prefiere no decir',
};

// Prevision labels
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

// Status labels
export const STATUS_LABELS: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  FIRMADO: 'Firmado',
  CANCELADO: 'Cancelado',
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  NO_REQUIERE_REVISION: 'Sin revisión pendiente',
  LISTA_PARA_REVISION: 'Pendiente de revisión médica',
  REVISADA_POR_MEDICO: 'Revisada por médico',
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

export const PROBLEM_STATUS_LABELS: Record<string, string> = {
  ACTIVO: 'Activo',
  CRONICO: 'Crónico',
  EN_ESTUDIO: 'En estudio',
  RESUELTO: 'Resuelto',
};
