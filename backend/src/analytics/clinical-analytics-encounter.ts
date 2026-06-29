import { type ClinicalSymptomSignal, type FoodRelation as AnalyticsFoodRelation } from './clinical-analytics-text';

export { buildClinicalAnalyticsEncounter } from './clinical-analytics-encounter-parser';
export { buildClinicalAnalyticsEncounterFromPersistence } from './clinical-analytics-encounter-persistence';

export type RawSection = {
  sectionKey: string;
  data: unknown;
  schemaVersion?: number | null;
};

export type RawEncounter = {
  id: string;
  patientId: string;
  createdAt: Date;
  patient: {
    id: string;
    fechaNacimiento?: Date | null;
    edad: number | null;
    sexo: string | null;
    prevision: string | null;
  };
  sections: RawSection[];
};

export type ProbableConditionData = {
  texto?: string;
  afeccionSeleccionada?: {
    id?: string;
    name?: string;
    confidence?: number;
  } | null;
};

export type DiagnosticData = {
  sospechas?: Array<{
    id?: string;
    diagnostico?: string;
    codigoCie10?: string;
    descripcionCie10?: string;
  }>;
};

export type AnamnesisProximaData = {
  relatoAmpliado?: string;
  factoresAgravantes?: string;
  factoresAtenuantes?: string;
  sintomasAsociados?: string;
  perfilDolorAbdominal?: {
    presente?: boolean;
    vomitos?: boolean;
    diarrea?: boolean;
    nauseas?: boolean;
    estrenimiento?: boolean;
    asociadoComida?: 'SI' | 'NO' | 'NO_CLARO';
    notas?: string;
  };
};

export type RevisionSystemItem = {
  checked?: boolean;
  notas?: string;
};

export type RevisionSistemasData = {
  gastrointestinal?: RevisionSystemItem;
};

export type ExamenFisicoData = {
  abdomen?: string;
};

export type TreatmentData = {
  medicamentosEstructurados?: Array<{
    id?: string;
    nombre?: string;
    dosis?: string;
    via?: string;
    frecuencia?: string;
    duracion?: string;
    sospechaId?: string;
  }>;
  examenesEstructurados?: Array<{
    id?: string;
    nombre?: string;
    indicacion?: string;
    estado?: string;
    sospechaId?: string;
  }>;
  derivacionesEstructuradas?: Array<{
    id?: string;
    nombre?: string;
    indicacion?: string;
    estado?: string;
    sospechaId?: string;
  }>;
};

export type ResponseData = {
  ajustesTratamiento?: string;
  planSeguimiento?: string;
  evolucion?: string;
  resultadosExamenes?: string;
  respuestaEstructurada?: {
    estado?: 'FAVORABLE' | 'PARCIAL' | 'SIN_RESPUESTA' | 'EMPEORA';
    notas?: string;
  };
  resultadosTratamientos?: Array<{
    treatmentItemId?: string;
    estado?: 'FAVORABLE' | 'PARCIAL' | 'SIN_RESPUESTA' | 'EMPEORA';
    notas?: string;
    adherenceStatus?: 'ADHERENTE' | 'PARCIAL' | 'NO_ADHERENTE';
    adverseEventSeverity?: 'LEVE' | 'MODERADO' | 'SEVERO';
    adverseEventNotes?: string;
  }>;
};

export type FoodRelation = AnalyticsFoodRelation;

export type AnalyticsSourceValue = 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';

export type ClinicalConditionEntry = {
  key: string;
  label: string;
  source: AnalyticsSourceValue;
  code?: string | null;
};

export type ClinicalSymptomEntry = ClinicalSymptomSignal;

export type ClinicalTreatmentEntry = {
  key: string;
  label: string;
  details?: string;
  associatedConditionLabels?: string[];
  adherenceStatus?: 'ADHERENTE' | 'PARCIAL' | 'NO_ADHERENTE';
  adverseEventSeverity?: 'LEVE' | 'MODERADO' | 'SEVERO';
  adverseEventNotes?: string;
};

export type EncounterDiagnosisEntry = {
  key: string;
  label: string;
  source: AnalyticsSourceValue;
  code?: string | null;
};

export type EncounterOutcomeEntry = {
  status: 'FAVORABLE' | 'PARCIAL' | 'SIN_RESPUESTA' | 'EMPEORA' | 'PROXY' | 'UNKNOWN';
  source: 'ESTRUCTURADO' | 'TEXTO' | 'PROBLEM_RESOLUTION';
  notes?: string;
  adherenceStatus?: 'ADHERENTE' | 'PARCIAL' | 'NO_ADHERENTE';
  adverseEventSeverity?: 'LEVE' | 'MODERADO' | 'SEVERO';
  adverseEventNotes?: string;
};

export type EncounterEpisodeEntry = {
  id: string;
  key: string;
  label: string;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive: boolean;
};

export type ParsedClinicalAnalyticsEncounter = {
  encounterId: string;
  patientId: string;
  createdAt: Date;
  patient: RawEncounter['patient'];
  episode: EncounterEpisodeEntry | null;
  probableConditions: ClinicalConditionEntry[];
  diagnosticConditions: ClinicalConditionEntry[];
  diagnoses: EncounterDiagnosisEntry[];
  symptomSignals: ClinicalSymptomEntry[];
  medications: ClinicalTreatmentEntry[];
  exams: ClinicalTreatmentEntry[];
  referrals: ClinicalTreatmentEntry[];
  searchableText: string;
  foodRelation: FoodRelation;
  outcome: EncounterOutcomeEntry;
  hasStructuredTreatment: boolean;
  hasTreatmentAdjustment: boolean;
  hasFollowUpPlan: boolean;
  hasFavorableResponse: boolean;
  hasUnfavorableResponse: boolean;
  hasDocumentedAdherence: boolean;
  hasAdverseEvent: boolean;
};
