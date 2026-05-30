/**
 * Section-specific data shapes used as the payload of each EncounterSection.
 * Each interface corresponds to a SectionKey value.
 */

import type { PatientRegistrationMode, PatientCompletenessStatus, PatientDemographicMissingField } from './patient.types';

// ── Identificación ──────────────────────────────────────────────

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

// ── Motivo de consulta ──────────────────────────────────────────

export interface MotivoConsultaData {
  texto?: string;
  afeccionSeleccionada?: { id: string; name: string; confidence: number } | null;
  modoSeleccion?: 'AUTO' | 'MANUAL';
}

// ── Anamnesis próxima ───────────────────────────────────────────

export interface AnamnesisProximaData {
  relatoAmpliado?: string;
  inicio?: string;
  evolucion?: string;
  factoresAgravantes?: string;
  factoresAtenuantes?: string;
  sintomasAsociados?: string;
  perfilDolorAbdominal?: PerfilDolorAbdominalData;
}

export type AsociacionComida = 'SI' | 'NO' | 'NO_CLARO';

export interface PerfilDolorAbdominalData {
  presente?: boolean;
  vomitos?: boolean;
  diarrea?: boolean;
  nauseas?: boolean;
  estrenimiento?: boolean;
  asociadoComida?: AsociacionComida;
  notas?: string;
}

// ── Anamnesis remota ────────────────────────────────────────────

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

// ── Revisión por sistemas ───────────────────────────────────────

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

// ── Examen físico ───────────────────────────────────────────────

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

// ── Sospecha diagnóstica ────────────────────────────────────────

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

// ── Tratamiento ─────────────────────────────────────────────────

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

export interface StructuredMedication {
  id: string;
  nombre: string;
  activeIngredient?: string;
  dosis?: string;
  via?: string;
  frecuencia?: string;
  duracion?: string;
  indicacion?: string;
  sospechaId?: string;
}

export interface StructuredOrder {
  id: string;
  nombre: string;
  indicacion?: string;
  estado?: 'PENDIENTE' | 'RECIBIDO' | 'REVISADO';
  resultado?: string;
  sospechaId?: string;
}

// ── Respuesta al tratamiento ────────────────────────────────────

export type EstadoRespuestaTratamiento = 'FAVORABLE' | 'PARCIAL' | 'SIN_RESPUESTA' | 'EMPEORA';
export type EstadoAdherenciaTratamiento = 'ADHERENTE' | 'PARCIAL' | 'NO_ADHERENTE';
export type SeveridadEventoAdversoTratamiento = 'LEVE' | 'MODERADO' | 'SEVERO';

export interface RespuestaTratamientoData {
  evolucion?: string;
  resultadosExamenes?: string;
  ajustesTratamiento?: string;
  planSeguimiento?: string;
  respuestaEstructurada?: RespuestaEstructuradaData;
  resultadosTratamientos?: StructuredTreatmentResponse[];
}

export interface RespuestaEstructuradaData {
  estado?: EstadoRespuestaTratamiento;
  notas?: string;
}

export interface StructuredTreatmentResponse {
  treatmentItemId: string;
  estado?: EstadoRespuestaTratamiento;
  notas?: string;
  adherenceStatus?: EstadoAdherenciaTratamiento;
  adverseEventSeverity?: SeveridadEventoAdversoTratamiento;
  adverseEventNotes?: string;
}

// ── Observaciones ───────────────────────────────────────────────

export interface ObservacionesData {
  observaciones?: string;
  notasInternas?: string;
  resumenClinico?: string;
}

// ── Union ───────────────────────────────────────────────────────

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
