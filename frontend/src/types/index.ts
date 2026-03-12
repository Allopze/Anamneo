// Patient types
export interface Patient {
  id: string;
  rut: string | null;
  rutExempt: boolean;
  rutExemptReason: string | null;
  nombre: string;
  edad: number;
  sexo: 'MASCULINO' | 'FEMENINO' | 'OTRO' | 'PREFIERE_NO_DECIR';
  trabajo: string | null;
  prevision: 'FONASA' | 'ISAPRE' | 'OTRA' | 'DESCONOCIDA';
  domicilio: string | null;
  createdAt: string;
  updatedAt: string;
  history?: PatientHistory;
  encounters?: Encounter[];
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
  label: string;
  order: number;
  data: Record<string, any>;
  completed: boolean;
  updatedAt: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  createdById: string;
  status: 'EN_PROGRESO' | 'COMPLETADO' | 'CANCELADO';
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  createdBy?: {
    id: string;
    nombre: string;
    email?: string;
  };
  sections?: EncounterSection[];
  progress?: {
    completed: number;
    total: number;
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

// Attachment types
export interface Attachment {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: {
    nombre: string;
  };
}

// ── Section data types (Q1) ──────────────────────────────────────────

export interface IdentificacionData {
  rut?: string;
  rutExempt?: boolean;
  rutExemptReason?: string;
  nombre?: string;
  edad?: number;
  sexo?: string;
  trabajo?: string;
  prevision?: string;
  domicilio?: string;
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
  prioridad: number;
  notas: string;
}

export interface SospechaDiagnosticaData {
  sospechas?: SospechaDiagnostica[];
}

export interface TratamientoData {
  plan?: string;
  indicaciones?: string;
  receta?: string;
  examenes?: string;
  derivaciones?: string;
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

// Status labels
export const STATUS_LABELS: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};
