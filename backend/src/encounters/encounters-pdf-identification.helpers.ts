import * as path from 'path';
import {
  getPatientDemographicsMissingFields,
  type PatientDemographicMissingField,
} from '../common/utils/patient-completeness';
import { resolvePatientIdentifiers } from '../patients/patients-identifiers';
import { IDENTIFICATION_SNAPSHOT_FIELD_META } from './encounters-pdf-labels.helpers';

const PDF_LOCALE = 'es-CL';
const PDF_TIME_ZONE = 'America/Santiago';

export function buildIdentificationSnapshotFromPatient(patient: any) {
  const identifiers = patient ? resolvePatientIdentifiers(patient) : null;
  return {
    nombre: identifiers?.nombre ?? '',
    rut: identifiers?.rut ?? '',
    rutExempt: Boolean(patient?.rutExempt),
    rutExemptReason: patient?.rutExemptReason ?? '',
    edad: patient?.edad ?? '',
    edadMeses: patient?.edadMeses ?? null,
    sexo: patient?.sexo ?? '',
    prevision: patient?.prevision ?? '',
    trabajo: patient?.trabajo ?? '',
    domicilio: identifiers?.domicilio ?? '',
  };
}

export function formatRutDisplay(data: { rut?: string | null; rutExempt?: boolean | null; rutExemptReason?: string | null }) {
  const rut = typeof data.rut === 'string' ? data.rut.trim() : '';
  if (rut) return rut;

  const rutExemptReason = typeof data.rutExemptReason === 'string' ? data.rutExemptReason.trim() : '';
  if (data.rutExempt && rutExemptReason) {
    return `Sin RUT (${rutExemptReason})`;
  }

  return 'Sin RUT';
}

function normalizeIdentificationComparisonValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
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

  if (!hasRut && !hasRutExemption) missingFields.push('rut');

  const hasBirthDate = hasEncounterIdentificationBirthDate(ident.fechaNacimiento);
  const hasAge = typeof ident.edad === 'number' && Number.isFinite(ident.edad) && ident.edad >= 0;

  if (!hasBirthDate && !hasAge) missingFields.push('edad');
  if (typeof ident.sexo !== 'string' || ident.sexo.trim().length === 0) missingFields.push('sexo');
  if (typeof ident.prevision !== 'string' || ident.prevision.trim().length === 0) missingFields.push('prevision');

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
  const patientName = sanitizeFilenameSegment(
    encounter?.patient ? resolvePatientIdentifiers(encounter.patient).nombre : null,
  );
  const encounterDate = formatEncounterDateOnly(encounter?.createdAt || new Date());
  if (prefix === 'ficha_clinica') {
    return `${patientName} - ${encounterDate}.pdf`;
  }
  return `${patientName} - ${prefix} - ${encounterDate}.pdf`;
}

export function getRutDisplayData(ident: Record<string, any>, patient: any) {
  const identifiers = patient ? resolvePatientIdentifiers(patient) : null;
  return {
    rut: ident.rut || identifiers?.rut,
    rutExempt: typeof ident.rutExempt === 'boolean' ? ident.rutExempt : patient.rutExempt,
    rutExemptReason:
      typeof ident.rutExemptReason === 'string' ? ident.rutExemptReason : patient.rutExemptReason,
  };
}

export { getPatientDemographicsMissingFields };
