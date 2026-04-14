import {
  PATIENT_COMPLETENESS_STATUS_LABELS,
  PATIENT_DEMOGRAPHIC_FIELD_LABELS,
  PATIENT_REGISTRATION_MODE_LABELS,
  PREVISION_LABELS,
  SEXO_LABELS,
  type IdentificacionData,
  type Patient,
  type PatientAdminSummary,
  type PatientCompletenessStatus,
  type PatientDemographicMissingField,
  type PatientRegistrationMode,
} from '@/types';

type PatientLike = Pick<
  Patient,
  | 'edad'
  | 'edadMeses'
  | 'sexo'
  | 'prevision'
  | 'completenessStatus'
  | 'registrationMode'
  | 'demographicsMissingFields'
>;

type PatientLikeAdmin = Pick<
  PatientAdminSummary,
  | 'edad'
  | 'edadMeses'
  | 'sexo'
  | 'prevision'
  | 'completenessStatus'
  | 'registrationMode'
  | 'demographicsMissingFields'
>;

type DemographicCarrier = PatientLike | PatientLikeAdmin;

type CompletenessCarrier = DemographicCarrier & {
  completenessStatus?: PatientCompletenessStatus;
  registrationMode?: PatientRegistrationMode;
  demographicsMissingFields?: PatientDemographicMissingField[];
};

const PATIENT_COMPLETENESS_BADGE_CLASSNAMES: Record<PatientCompletenessStatus, string> = {
  INCOMPLETA: 'border border-status-red/35 bg-status-red/10 text-status-red-text',
  PENDIENTE_VERIFICACION: 'border border-status-yellow/70 bg-status-yellow/40 text-accent-text',
  VERIFICADA: 'border border-status-green/35 bg-status-green/10 text-status-green-text',
};

export function formatPatientAge(edad?: number | null, edadMeses?: number | null) {
  if (typeof edad !== 'number') {
    return 'Edad pendiente';
  }

  if (typeof edadMeses === 'number' && edadMeses > 0) {
    return `${edad} años ${edadMeses} meses`;
  }

  return `${edad} años`;
}

export function formatPatientSex(sexo?: string | null) {
  if (!sexo) {
    return 'Sin definir';
  }

  return SEXO_LABELS[sexo] || sexo;
}

export function formatPatientPrevision(prevision?: string | null) {
  if (!prevision) {
    return 'Sin definir';
  }

  return PREVISION_LABELS[prevision] || prevision;
}

export function formatPatientRut(
  rut?: string | null,
  rutExempt?: boolean | null,
  rutExemptReason?: string | null,
) {
  const normalizedRut = typeof rut === 'string' ? rut.trim() : '';
  if (normalizedRut) {
    return normalizedRut;
  }

  const normalizedReason = typeof rutExemptReason === 'string' ? rutExemptReason.trim() : '';
  if (rutExempt && normalizedReason) {
    return `Sin RUT (${normalizedReason})`;
  }

  return 'Sin RUT';
}

export function formatPatientMissingFields(fields?: PatientDemographicMissingField[] | null) {
  return (fields || []).map((field) => PATIENT_DEMOGRAPHIC_FIELD_LABELS[field] || field);
}

export function getIdentificationMissingFields(data: Pick<IdentificacionData, 'rut' | 'rutExempt' | 'rutExemptReason' | 'edad' | 'sexo' | 'prevision'>) {
  const missingFields: PatientDemographicMissingField[] = [];
  const hasRut = typeof data.rut === 'string' && data.rut.trim().length > 0;
  const hasRutExemption = Boolean(data.rutExempt)
    && typeof data.rutExemptReason === 'string'
    && data.rutExemptReason.trim().length > 0;

  if (!hasRut && !hasRutExemption) {
    missingFields.push('rut');
  }

  if (typeof data.edad !== 'number') {
    missingFields.push('edad');
  }

  if (!data.sexo) {
    missingFields.push('sexo');
  }

  if (!data.prevision) {
    missingFields.push('prevision');
  }

  return missingFields;
}

export function getPatientCompletenessMeta(patient: CompletenessCarrier) {
  const completenessStatus = patient.completenessStatus || 'INCOMPLETA';
  const registrationMode = patient.registrationMode || 'COMPLETO';
  const missingFieldLabels = formatPatientMissingFields(patient.demographicsMissingFields);
  const description = getPatientCompletenessDescription(completenessStatus, missingFieldLabels);

  return {
    label: PATIENT_COMPLETENESS_STATUS_LABELS[completenessStatus],
    registrationLabel: PATIENT_REGISTRATION_MODE_LABELS[registrationMode],
    badgeClassName: PATIENT_COMPLETENESS_BADGE_CLASSNAMES[completenessStatus],
    description,
    missingFieldLabels,
  };
}

function getPatientCompletenessDescription(
  status: PatientCompletenessStatus,
  missingFieldLabels: string[],
) {
  if (status === 'INCOMPLETA') {
    if (missingFieldLabels.length === 0) {
      return 'Faltan datos demográficos clave antes de considerar la ficha administrativa como completa.';
    }

    return `Faltan datos demográficos clave: ${missingFieldLabels.join(', ')}.`;
  }

  if (status === 'PENDIENTE_VERIFICACION') {
    return 'La ficha ya tiene los datos mínimos, pero todavía no fue validada por un médico.';
  }

  return 'La identificación administrativa mínima ya fue validada clínicamente.';
}
