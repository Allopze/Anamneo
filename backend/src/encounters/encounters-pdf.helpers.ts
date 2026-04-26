/**
 * Pure helper functions and constants for PDF generation.
 * Extracted from EncountersPdfService to keep the service focused on document orchestration.
 */
import * as path from 'path';
import {
  getPatientDemographicsMissingFields,
  type PatientDemographicMissingField,
} from '../common/utils/patient-completeness';

// ─── Display maps ────────────────────────────────────────────────────────────

export const SEXO_MAP: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
  PREFIERE_NO_DECIR: 'Prefiere no decir',
};

export const PREVISION_MAP: Record<string, string> = {
  FONASA: 'FONASA',
  ISAPRE: 'ISAPRE',
  OTRA: 'Otra',
  DESCONOCIDA: 'Desconocida',
};

export const ESTADO_GENERAL_MAP: Record<string, string> = {
  BUEN_ESTADO: 'Buen estado general',
  REGULAR_ESTADO: 'Regular estado general',
  MAL_ESTADO: 'Mal estado general',
};

export const STATUS_MAP: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  FIRMADO: 'Firmado',
  CANCELADO: 'Cancelado',
};

export const REVIEW_STATUS_MAP: Record<string, string> = {
  NO_REQUIERE_REVISION: 'Sin revision pendiente',
  LISTA_PARA_REVISION: 'Pendiente de revision medica',
  REVISADA_POR_MEDICO: 'Revisada por medico',
};

export const IDENTIFICATION_SNAPSHOT_FIELD_META = [
  { key: 'nombre', label: 'nombre' },
  { key: 'rut', label: 'RUT' },
  { key: 'rutExempt', label: 'exención de RUT' },
  { key: 'rutExemptReason', label: 'motivo de exención' },
  { key: 'edad', label: 'edad' },
  { key: 'edadMeses', label: 'edad (meses)' },
  { key: 'sexo', label: 'sexo' },
  { key: 'prevision', label: 'previsión' },
  { key: 'trabajo', label: 'trabajo' },
  { key: 'domicilio', label: 'domicilio' },
] as const;

export const ANAMNESIS_REMOTA_FIELD_LABELS: [string, string][] = [
  ['Antecedentes médicos', 'antecedentesMedicos'],
  ['Antecedentes quirúrgicos', 'antecedentesQuirurgicos'],
  ['Antecedentes ginecoobstétricos', 'antecedentesGinecoobstetricos'],
  ['Antecedentes familiares', 'antecedentesFamiliares'],
  ['Hábitos', 'habitos'],
  ['Medicamentos', 'medicamentos'],
  ['Alergias', 'alergias'],
  ['Inmunizaciones', 'inmunizaciones'],
  ['Antecedentes sociales', 'antecedentesSociales'],
  ['Antecedentes personales', 'antecedentesPersonales'],
];

const PDF_LOCALE = 'es-CL';
const PDF_TIME_ZONE = 'America/Santiago';

// ─── Pure formatting helpers ─────────────────────────────────────────────────

export function buildIdentificationSnapshotFromPatient(patient: any) {
  return {
    nombre: patient?.nombre ?? '',
    rut: patient?.rut ?? '',
    rutExempt: Boolean(patient?.rutExempt),
    rutExemptReason: patient?.rutExemptReason ?? '',
    edad: patient?.edad ?? '',
    edadMeses: patient?.edadMeses ?? null,
    sexo: patient?.sexo ?? '',
    prevision: patient?.prevision ?? '',
    trabajo: patient?.trabajo ?? '',
    domicilio: patient?.domicilio ?? '',
  };
}

export function formatRutDisplay(data: { rut?: string | null; rutExempt?: boolean | null; rutExemptReason?: string | null }) {
  const rut = typeof data.rut === 'string' ? data.rut.trim() : '';
  if (rut) {
    return rut;
  }

  const rutExemptReason =
    typeof data.rutExemptReason === 'string' ? data.rutExemptReason.trim() : '';
  if (data.rutExempt && rutExemptReason) {
    return `Sin RUT (${rutExemptReason})`;
  }

  return 'Sin RUT';
}

export function formatSospechaDiagnosticaLabel(sospecha: Record<string, unknown>) {
  const diagnostico = typeof sospecha.diagnostico === 'string' ? sospecha.diagnostico.trim() : '';
  const codigoCie10 = typeof sospecha.codigoCie10 === 'string' ? sospecha.codigoCie10.trim() : '';
  const descripcionCie10 =
    typeof sospecha.descripcionCie10 === 'string' ? sospecha.descripcionCie10.trim() : '';

  const baseLabel = diagnostico || descripcionCie10 || 'Diagnóstico sin descripción';
  if (!codigoCie10) {
    return baseLabel;
  }

  if (descripcionCie10) {
    return `${baseLabel} (${codigoCie10}: ${descripcionCie10})`;
  }

  return `${baseLabel} (${codigoCie10})`;
}

function normalizeIdentificationComparisonValue(value: unknown) {
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

  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

export function getIdentificationDifferenceLabels(encounter: any, ident: Record<string, unknown>) {
  const patientSnapshot = buildIdentificationSnapshotFromPatient(encounter.patient);

  return IDENTIFICATION_SNAPSHOT_FIELD_META
    .filter(({ key }) => (
      normalizeIdentificationComparisonValue(ident[key]) !== normalizeIdentificationComparisonValue(patientSnapshot[key])
    ))
    .map(({ label }) => label);
}

export function formatEncounterDateTime(value: string | Date) {
  return new Intl.DateTimeFormat(PDF_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PDF_TIME_ZONE,
  }).format(new Date(value));
}

export function formatEncounterDateOnly(value: string | Date) {
  return new Intl.DateTimeFormat(PDF_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: PDF_TIME_ZONE,
  }).format(new Date(value)).replace(/\//g, '-');
}

export function hasEncounterIdentificationBirthDate(value: unknown) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  return typeof value === 'string' && value.trim().length > 0;
}

export function getEncounterIdentificationMissingFields(
  ident: Record<string, unknown>,
): PatientDemographicMissingField[] {
  const missingFields: PatientDemographicMissingField[] = [];

  const hasRut = typeof ident.rut === 'string' && ident.rut.trim().length > 0;
  const hasRutExemption = Boolean(ident.rutExempt)
    && typeof ident.rutExemptReason === 'string'
    && ident.rutExemptReason.trim().length > 0;

  if (!hasRut && !hasRutExemption) {
    missingFields.push('rut');
  }

  const hasBirthDate = hasEncounterIdentificationBirthDate(ident.fechaNacimiento);
  const hasAge = typeof ident.edad === 'number' && Number.isFinite(ident.edad) && ident.edad >= 0;

  if (!hasBirthDate && !hasAge) {
    missingFields.push('edad');
  }

  if (typeof ident.sexo !== 'string' || ident.sexo.trim().length === 0) {
    missingFields.push('sexo');
  }

  if (typeof ident.prevision !== 'string' || ident.prevision.trim().length === 0) {
    missingFields.push('prevision');
  }

  return missingFields;
}

export function sanitizeFilenameSegment(value: string | undefined | null) {
  const normalized = (value || 'Paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim();

  return path.basename(normalized || 'paciente');
}

export function buildEncounterDocumentFilename(encounter: any, prefix: string) {
  const patientName = sanitizeFilenameSegment(encounter?.patient?.nombre);
  const encounterDate = formatEncounterDateOnly(encounter?.createdAt || new Date());
  if (prefix === 'ficha_clinica') {
    return `${patientName} - ${encounterDate}.pdf`;
  }
  return `${patientName} - ${prefix} - ${encounterDate}.pdf`;
}

export function getTreatmentPlanText(trat: Record<string, any>) {
  const plan = typeof trat.plan === 'string' ? trat.plan.trim() : '';
  const indicaciones = typeof trat.indicaciones === 'string' ? trat.indicaciones.trim() : '';

  if (!plan) {
    return indicaciones;
  }

  if (!indicaciones || indicaciones === plan) {
    return plan;
  }

  return `${plan}\n\nIndicaciones adicionales:\n${indicaciones}`;
}

export function formatStructuredMedicationLine(item: Record<string, unknown>) {
  const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
  const activeIngredient = typeof item.activeIngredient === 'string' ? item.activeIngredient.trim() : '';
  const activeIngredientLabel = activeIngredient && activeIngredient.toLowerCase() !== nombre.toLowerCase()
    ? `PA: ${activeIngredient}`
    : '';
  const dosis = typeof item.dosis === 'string' ? item.dosis.trim() : '';
  const via = typeof item.via === 'string' ? item.via.trim() : '';
  const frecuencia = typeof item.frecuencia === 'string' ? item.frecuencia.trim() : '';
  const duracion = typeof item.duracion === 'string' ? item.duracion.trim() : '';

  return [nombre, activeIngredientLabel, dosis, via, frecuencia, duracion].filter(Boolean).join(' · ');
}

export function formatHistoryFieldText(value: unknown) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }

  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const text = typeof record.texto === 'string' ? record.texto.trim() : '';

  if (!items.length) {
    return text;
  }

  if (!text) {
    return items.join(', ');
  }

  return `${items.join(', ')}. ${text}`;
}

export function formatRevisionSystemEntries(revision: Record<string, any>) {
  return Object.entries(revision || {})
    .map(([key, value]) => {
      if (!value || typeof value !== 'object') {
        return null;
      }

      const checked = Boolean((value as { checked?: boolean }).checked);
      const rawNotes = (value as { notas?: string }).notas;
      const notes = typeof rawNotes === 'string' ? rawNotes.trim() : '';

      if (!checked && !notes) {
        return null;
      }

      return {
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
        text: notes || 'Sin hallazgos descritos',
      };
    })
    .filter((entry): entry is { label: string; text: string } => entry !== null);
}

export function getRutDisplayData(ident: Record<string, any>, patient: any) {
  return {
    rut: ident.rut || patient.rut,
    rutExempt: typeof ident.rutExempt === 'boolean' ? ident.rutExempt : patient.rutExempt,
    rutExemptReason:
      typeof ident.rutExemptReason === 'string' ? ident.rutExemptReason : patient.rutExemptReason,
  };
}

export { getPatientDemographicsMissingFields };
