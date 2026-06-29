// Patient types
export type PatientSexo = 'MASCULINO' | 'FEMENINO' | 'OTRO' | 'PREFIERE_NO_DECIR';
export type PatientPrevision = 'FONASA' | 'ISAPRE' | 'OTRA' | 'DESCONOCIDA';
export type PatientRegistrationMode = 'COMPLETO' | 'RAPIDO';
export type PatientCompletenessStatus = 'INCOMPLETA' | 'PENDIENTE_VERIFICACION' | 'VERIFICADA';
export type PatientDemographicMissingField = 'rut' | 'edad' | 'sexo' | 'prevision';

export interface PatientHistoryFieldValue {
  texto?: string;
  items?: string[];
}

export interface PatientLegalStatus {
  canReceiveCare: boolean;
  canCreateEncounter: boolean;
  canEditEncounter: boolean;
  canUploadAttachment: boolean;
  canRegisterClinicalConsent: boolean;
  canRegisterDataProcessingConsent: boolean;
  hasActiveDataProcessingConsent: boolean | null;
  dataProcessingConsent: {
    id: string;
    legalDocumentVersion: string | null;
    grantedAt: string | Date | null;
    evidenceHash: string | null;
  } | null;
  activeDataRequestCount: number;
  activeDataRequests: Array<{
    id: string;
    requestType: string;
    status: string;
    dueDate: string | Date | null;
  }>;
  legalBlockReason: string | null;
  requiredActions: Array<{
    code: string;
    label: string;
    severity: 'warning' | 'blocking';
  }>;
}

export interface Patient {
  id: string;
  /** Decrypted from rutEnc (Ley 21.719 Art 14 quinquies). Server-side PII — never persist client-side. */
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
  blockedAt?: string | null;
  blockedReason?: string | null;
  blockedById?: string | null;
  processingObjections?: unknown;
  legalStatus?: PatientLegalStatus;
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
  antecedentesMedicos: PatientHistoryFieldValue | string | null;
  antecedentesQuirurgicos: PatientHistoryFieldValue | string | null;
  antecedentesGinecoobstetricos: PatientHistoryFieldValue | string | null;
  antecedentesFamiliares: PatientHistoryFieldValue | string | null;
  habitos: PatientHistoryFieldValue | string | null;
  medicamentos: PatientHistoryFieldValue | string | null;
  alergias: PatientHistoryFieldValue | string | null;
  inmunizaciones: PatientHistoryFieldValue | string | null;
  antecedentesSociales: PatientHistoryFieldValue | string | null;
  antecedentesPersonales: PatientHistoryFieldValue | string | null;
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
    frecuenciaCardiaca: number | null;
    frecuenciaRespiratoria: number | null;
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

export * from './patient-labels';
