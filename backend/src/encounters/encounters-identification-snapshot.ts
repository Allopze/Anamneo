import { parseStoredJson } from '../common/utils/encounter-sections';

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

export function normalizeIdentificationComparisonValue(value: unknown) {
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

export function matchesCurrentPatientSnapshot(encounter: { patient: any }, identificationData: Record<string, unknown>) {
  const patientSnapshot = buildIdentificationSnapshotFromPatient(encounter.patient);

  return IDENTIFICATION_SNAPSHOT_FIELD_META.every(
    ({ key }) =>
      normalizeIdentificationComparisonValue(identificationData[key]) ===
      normalizeIdentificationComparisonValue(patientSnapshot[key]),
  );
}

export function buildIdentificationSnapshotStatus(encounter: any) {
  const patientSnapshot = buildIdentificationSnapshotFromPatient(encounter.patient);
  const identificationSection = (encounter.sections || []).find(
    (section: any) => section.sectionKey === 'IDENTIFICACION',
  );
  const sectionData = parseStoredJson(identificationSection?.data, null);
  const snapshotData =
    typeof sectionData === 'object' && sectionData !== null ? (sectionData as Record<string, unknown>) : {};

  const differingEntries = IDENTIFICATION_SNAPSHOT_FIELD_META.filter(
    ({ key }) =>
      normalizeIdentificationComparisonValue(snapshotData[key]) !==
      normalizeIdentificationComparisonValue(patientSnapshot[key]),
  );

  return {
    isSnapshot: true,
    snapshotCreatedAt: encounter.createdAt,
    sourcePatientUpdatedAt: encounter.patient?.updatedAt ?? null,
    hasDifferences: differingEntries.length > 0,
    differingFields: differingEntries.map(({ key }) => key),
    differingFieldLabels: differingEntries.map(({ label }) => label),
  };
}
