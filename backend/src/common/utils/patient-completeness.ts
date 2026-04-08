type PatientCompletenessShape = {
  rut?: string | null;
  rutExempt?: boolean | null;
  rutExemptReason?: string | null;
  edad?: number | null;
  sexo?: string | null;
  prevision?: string | null;
};

type PatientClinicalOutputEligibilityShape = PatientCompletenessShape & {
  completenessStatus?: string | null;
};

export const PATIENT_DEMOGRAPHIC_MISSING_FIELDS = [
  'rut',
  'edad',
  'sexo',
  'prevision',
] as const;

export const PATIENT_VERIFICATION_FIELD_KEYS = [
  'nombre',
  'rut',
  'rutExempt',
  'rutExemptReason',
  'edad',
  'edadMeses',
  'sexo',
  'prevision',
] as const;

export const PATIENT_DEMOGRAPHIC_FIELD_LABELS: Record<typeof PATIENT_DEMOGRAPHIC_MISSING_FIELDS[number], string> = {
  rut: 'RUT',
  edad: 'edad',
  sexo: 'sexo',
  prevision: 'prevision',
};

export const ENCOUNTER_CLINICAL_OUTPUT_BLOCKED_ACTIONS = [
  'COMPLETE_ENCOUNTER',
  'EXPORT_OFFICIAL_DOCUMENTS',
  'PRINT_CLINICAL_RECORD',
] as const;

export type PatientDemographicMissingField = typeof PATIENT_DEMOGRAPHIC_MISSING_FIELDS[number];
export type PatientVerificationFieldKey = typeof PATIENT_VERIFICATION_FIELD_KEYS[number];
export type EncounterClinicalOutputAction = typeof ENCOUNTER_CLINICAL_OUTPUT_BLOCKED_ACTIONS[number];

export type EncounterClinicalOutputBlock = {
  completenessStatus: 'INCOMPLETA' | 'PENDIENTE_VERIFICACION';
  missingFields: PatientDemographicMissingField[];
  blockedActions: EncounterClinicalOutputAction[];
  reason: string;
};

export function getPatientDemographicsMissingFields(
  patient: PatientCompletenessShape,
): PatientDemographicMissingField[] {
  const missingFields: PatientDemographicMissingField[] = [];

  const hasRut = typeof patient.rut === 'string' && patient.rut.trim().length > 0;
  const hasRutExemption = Boolean(patient.rutExempt)
    && typeof patient.rutExemptReason === 'string'
    && patient.rutExemptReason.trim().length > 0;

  if (!hasRut && !hasRutExemption) {
    missingFields.push('rut');
  }

  if (typeof patient.edad !== 'number' || !Number.isFinite(patient.edad) || patient.edad < 0) {
    missingFields.push('edad');
  }

  if (typeof patient.sexo !== 'string' || patient.sexo.trim().length === 0) {
    missingFields.push('sexo');
  }

  if (typeof patient.prevision !== 'string' || patient.prevision.trim().length === 0) {
    missingFields.push('prevision');
  }

  return missingFields;
}

export function isPatientDemographicsComplete(patient: PatientCompletenessShape): boolean {
  return getPatientDemographicsMissingFields(patient).length === 0;
}

export function getEncounterClinicalOutputBlock(
  patient: PatientClinicalOutputEligibilityShape | null | undefined,
): EncounterClinicalOutputBlock | null {
  if (!patient) {
    return null;
  }

  const missingFields = getPatientDemographicsMissingFields(patient);
  const completenessStatus = resolveEncounterClinicalOutputBlockStatus(patient, missingFields);

  if (!completenessStatus) {
    return null;
  }

  return {
    completenessStatus,
    missingFields,
    blockedActions: [...ENCOUNTER_CLINICAL_OUTPUT_BLOCKED_ACTIONS],
    reason: buildEncounterClinicalOutputBlockReason(completenessStatus, missingFields),
  };
}

export function getEncounterClinicalOutputBlockMessage(
  block: EncounterClinicalOutputBlock,
  action: EncounterClinicalOutputAction,
): string {
  return `No se puede ${getEncounterClinicalOutputActionLabel(action)}. ${block.reason}`;
}

export function hasPatientVerificationFieldChanges(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  return PATIENT_VERIFICATION_FIELD_KEYS.some((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      return false;
    }

    return normalizeCompletenessValue(previous[key]) !== normalizeCompletenessValue(next[key]);
  });
}

function normalizeCompletenessValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  return JSON.stringify(value);
}

function resolveEncounterClinicalOutputBlockStatus(
  patient: PatientClinicalOutputEligibilityShape,
  missingFields: PatientDemographicMissingField[],
): 'INCOMPLETA' | 'PENDIENTE_VERIFICACION' | null {
  if (patient.completenessStatus === 'INCOMPLETA' || patient.completenessStatus === 'PENDIENTE_VERIFICACION') {
    return patient.completenessStatus;
  }

  if (missingFields.length > 0) {
    return 'INCOMPLETA';
  }

  return null;
}

function buildEncounterClinicalOutputBlockReason(
  completenessStatus: 'INCOMPLETA' | 'PENDIENTE_VERIFICACION',
  missingFields: PatientDemographicMissingField[],
): string {
  if (completenessStatus === 'INCOMPLETA') {
    if (missingFields.length === 0) {
      return 'La ficha maestra del paciente sigue incompleta y todavía no habilita cierres ni documentos clínicos oficiales.';
    }

    return `La ficha maestra del paciente sigue incompleta. Faltan datos demográficos clave: ${formatMissingFieldLabels(missingFields).join(', ')}.`;
  }

  return 'La ficha maestra del paciente está pendiente de verificación médica antes de habilitar cierres y documentos clínicos oficiales.';
}

function formatMissingFieldLabels(fields: PatientDemographicMissingField[]) {
  return fields.map((field) => PATIENT_DEMOGRAPHIC_FIELD_LABELS[field] || field);
}

function getEncounterClinicalOutputActionLabel(action: EncounterClinicalOutputAction) {
  if (action === 'COMPLETE_ENCOUNTER') {
    return 'completar la atención';
  }

  if (action === 'EXPORT_OFFICIAL_DOCUMENTS') {
    return 'emitir documentos clínicos oficiales';
  }

  return 'imprimir la ficha clínica';
}