import type {
  Patient,
  PatientCompletenessStatus,
  PatientDemographicMissingField,
  PatientProblem,
  PatientTask,
} from './patient.types';

// Re-export section-data types so existing `@/types` imports keep working.
export type {
  IdentificacionData,
  MotivoConsultaData,
  AnamnesisProximaData,
  AnamnesisRemotaData,
  RevisionSistemasData,
  ExamenFisicoData,
  SospechaDiagnosticaData,
  TratamientoData,
  RespuestaTratamientoData,
  ObservacionesData,
  SectionData,
  StructuredMedication,
  StructuredOrder,
  StructuredTreatmentResponse,
  RespuestaEstructuradaData,
  SignosVitales,
  SystemReviewItem,
  HistoryFieldValue,
  SospechaDiagnostica,
  PerfilDolorAbdominalData,
  AsociacionComida,
  EstadoRespuestaTratamiento,
  EstadoAdherenciaTratamiento,
  SeveridadEventoAdversoTratamiento,
} from './encounter-section-data.types';

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
  requiredForCompletion?: boolean;
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
  signatureBaseline?: {
    id: string;
    status: 'COMPLETADO' | 'FIRMADO';
    createdAt: string;
    closureNote?: string | null;
    sections: EncounterSection[];
    attachments: Attachment[];
  } | null;
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
  cieCode?: string | null;
  synonyms: string[];
  tags: string[];
  active: boolean;
  scope?: 'GLOBAL' | 'LOCAL';
  baseConditionId?: string | null;
}

export interface MedicationCatalogItem {
  id: string;
  name: string;
  activeIngredient: string;
  defaultDose?: string;
  defaultRoute?: string;
  defaultFrequency?: string;
  active: boolean;
}

export interface ConditionSuggestion {
  id: string;
  name: string;
  score: number;
  confidence: number;
  reasons?: Array<{
    kind: 'NAME' | 'SYNONYM' | 'TAG';
    label: string;
    matchedValue: string;
    matches: string[];
  }>;
}

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
