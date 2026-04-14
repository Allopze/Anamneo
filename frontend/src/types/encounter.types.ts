import type {
  Patient,
  PatientCompletenessStatus,
  PatientDemographicMissingField,
  PatientProblem,
  PatientTask,
} from './patient.types';

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

export type EncounterClinicalOutputAction = (typeof ENCOUNTER_CLINICAL_OUTPUT_ACTIONS)[number];

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

// ── Section data types ──────────────────────────────────────────

import type { PatientRegistrationMode } from './patient.types';

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
  negativa?: boolean;
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

// Encounter/section labels
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
