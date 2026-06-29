import { calculateAgeFromBirthDate, extractDateOnlyIso } from '../common/utils/local-date';
import type { ParsedClinicalAnalyticsEncounter } from './clinical-analytics.helpers';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const SMALL_COHORT_PATIENT_THRESHOLD = 10;

export function getDayInMs() {
  return DAY_IN_MS;
}

export function resolveDefaultFromDate(reference = new Date()) {
  return extractDateOnlyIso(new Date(reference.getTime() - 89 * DAY_IN_MS));
}

export function ratio(partial: number, total: number) {
  return total > 0 ? partial / total : 0;
}

export function buildCaveats(hasConditionFilter: boolean, matchedPatients: number) {
  return [
    'Los resultados son descriptivos y observacionales; no prueban efectividad comparativa ni causalidad.',
    'La afección probable y la sospecha diagnóstica no equivalen necesariamente a diagnóstico clínico confirmado.',
    'Los ajustes de tratamiento y la evolución siguen dependiendo en parte de texto libre.',
    'La respuesta favorable proxy se imputa al plan estructurado del encuentro; si hubo varios tratamientos en la misma atención, no se atribuye causalidad a uno solo.',
    ...(matchedPatients > 0 && matchedPatients < SMALL_COHORT_PATIENT_THRESHOLD
      ? [
          `Cohorte pequeña (${matchedPatients} pacientes): se ocultaron desgloses detallados para reducir riesgo de reidentificación.`,
        ]
      : []),
    ...(hasConditionFilter
      ? ['Con la fuente "Todas", el filtro también revisa motivo/anamnesis para soportar cohortes por síntoma o motivo de consulta, por ejemplo dolor abdominal.']
      : []),
  ];
}

export function calculateAverageAge(encounters: ParsedClinicalAnalyticsEncounter[]) {
  const uniquePatients = new Map<string, number>();

  for (const encounter of encounters) {
    if (uniquePatients.has(encounter.patientId)) {
      continue;
    }

    const ageAtEncounter = encounter.patient.fechaNacimiento
      ? calculateAgeFromBirthDate(encounter.patient.fechaNacimiento, encounter.createdAt).edad
      : encounter.patient.edad;

    if (ageAtEncounter === null || ageAtEncounter === undefined) {
      continue;
    }

    uniquePatients.set(encounter.patientId, ageAtEncounter);
  }

  if (uniquePatients.size === 0) {
    return null;
  }

  const totalAge = [...uniquePatients.values()].reduce((sum, age) => sum + age, 0);
  return totalAge / uniquePatients.size;
}
