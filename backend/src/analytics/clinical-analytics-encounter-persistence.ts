import { buildClinicalAnalyticsEncounter } from './clinical-analytics-encounter';
import type {
  ClinicalConditionEntry,
  ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics-encounter';
import {
  aggregateTreatmentOutcome,
  buildPersistedTreatmentEntries,
  uniqueBy,
} from './clinical-analytics-encounter-utils';

type RawEncounterWithPersistence = {
  diagnoses?: Array<{
    source: 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
    label: string;
    normalizedLabel: string;
    code?: string | null;
  }>;
  treatments?: Array<{
    treatmentType: 'MEDICATION' | 'EXAM' | 'REFERRAL';
    label: string;
    normalizedLabel: string;
    details?: string | null;
    dose?: string | null;
    route?: string | null;
    frequency?: string | null;
    duration?: string | null;
    indication?: string | null;
    status?: string | null;
    diagnosis?: { label?: string | null; normalizedLabel?: string | null } | null;
    outcomes?: Array<{
      outcomeStatus: string;
      outcomeSource: string;
      notes?: string | null;
      adherenceStatus?: string | null;
      adverseEventSeverity?: string | null;
      adverseEventNotes?: string | null;
    }> | null;
  }>;
  episode?: {
    id: string;
    label: string;
    normalizedLabel: string;
    startDate?: Date | null;
    endDate?: Date | null;
    isActive: boolean;
  } | null;
  [key: string]: any;
};

export function buildClinicalAnalyticsEncounterFromPersistence(
  rawEncounter: RawEncounterWithPersistence,
): ParsedClinicalAnalyticsEncounter {
  const parsedBySections = buildClinicalAnalyticsEncounter(rawEncounter as any);

  if (!rawEncounter.diagnoses && !rawEncounter.treatments && !rawEncounter.episode) {
    return parsedBySections;
  }

  const persistedDiagnoses = rawEncounter.diagnoses?.map((entry) => ({
    key: entry.normalizedLabel,
    label: entry.label,
    source: entry.source,
    code: entry.code ?? null,
  })) ?? [];

  const diagnoses = uniqueBy(
    [...parsedBySections.diagnoses, ...persistedDiagnoses],
    (entry) => `${entry.source}:${entry.key}:${entry.code ?? ''}`,
  );

  const probableConditions = uniqueBy(
    [
      ...parsedBySections.probableConditions,
      ...diagnoses.filter((entry): entry is ClinicalConditionEntry => entry.source === 'AFECCION_PROBABLE'),
    ],
    (entry) => `${entry.key}:${entry.code ?? ''}`,
  );

  const diagnosticConditions = uniqueBy(
    [
      ...parsedBySections.diagnosticConditions,
      ...diagnoses.filter((entry): entry is ClinicalConditionEntry => entry.source === 'SOSPECHA_DIAGNOSTICA'),
    ],
    (entry) => `${entry.key}:${entry.code ?? ''}`,
  );

  const associatedConditionLabels = diagnoses.length > 0
    ? [...new Set(diagnoses.map((entry) => entry.label.trim()))]
    : undefined;

  const persistedMedications = buildPersistedTreatmentEntries(rawEncounter.treatments, 'MEDICATION', associatedConditionLabels);
  const persistedExams = buildPersistedTreatmentEntries(rawEncounter.treatments, 'EXAM', associatedConditionLabels);
  const persistedReferrals = buildPersistedTreatmentEntries(rawEncounter.treatments, 'REFERRAL', associatedConditionLabels);

  const medications = uniqueBy([...parsedBySections.medications, ...persistedMedications], (entry) => entry.key);
  const exams = uniqueBy([...parsedBySections.exams, ...persistedExams], (entry) => entry.key);
  const referrals = uniqueBy([...parsedBySections.referrals, ...persistedReferrals], (entry) => entry.key);

  const outcome = aggregateTreatmentOutcome(
    rawEncounter.treatments?.flatMap((entry) => entry.outcomes ?? []) ?? [],
  ) ?? parsedBySections.outcome;

  return {
    ...parsedBySections,
    episode: rawEncounter.episode
      ? {
          id: rawEncounter.episode.id,
          key: rawEncounter.episode.normalizedLabel,
          label: rawEncounter.episode.label,
          startDate: rawEncounter.episode.startDate,
          endDate: rawEncounter.episode.endDate,
          isActive: rawEncounter.episode.isActive,
        }
      : parsedBySections.episode,
    probableConditions,
    diagnosticConditions,
    diagnoses,
    medications,
    exams,
    referrals,
    outcome,
    hasStructuredTreatment: medications.length > 0 || exams.length > 0 || referrals.length > 0 || parsedBySections.hasStructuredTreatment,
    hasFavorableResponse: outcome.status === 'FAVORABLE' || parsedBySections.hasFavorableResponse,
    hasUnfavorableResponse: outcome.status === 'SIN_RESPUESTA' || outcome.status === 'EMPEORA' || parsedBySections.hasUnfavorableResponse,
    hasDocumentedAdherence: Boolean(outcome.adherenceStatus) || parsedBySections.hasDocumentedAdherence,
    hasAdverseEvent: Boolean(outcome.adverseEventSeverity) || parsedBySections.hasAdverseEvent,
  };
}
