import { normalizeConditionName } from '../conditions/conditions-helpers';
import {
  matchesAnalyticsQuery,
  type ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics.helpers';
import type { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';
import type { ScopedProblem, EncounterOutcomeEvaluation } from './clinical-analytics-summary.types';
import { getDayInMs } from './clinical-analytics-summary-common.helpers';

export function evaluateEncounterOutcome(params: {
  encounter: ParsedClinicalAnalyticsEncounter;
  encountersByPatient: Map<string, ParsedClinicalAnalyticsEncounter[]>;
  encountersByEpisode: Map<string, ParsedClinicalAnalyticsEncounter[]>;
  alertsByPatient: Map<string, Date[]>;
  problemsByPatient: Map<string, ScopedProblem[]>;
  normalizedCondition: string;
  source: ClinicalAnalyticsQueryDto['source'];
  followUpDays: number;
}) {
  const {
    encounter,
    encountersByPatient,
    encountersByEpisode,
    alertsByPatient,
    problemsByPatient,
    normalizedCondition,
    source,
    followUpDays,
  } = params;

  const patientEncounters = encountersByPatient.get(encounter.patientId) || [];
  const episodeEncounters = encounter.episode ? encountersByEpisode.get(encounter.episode.id) || [] : [];
  const comparableEncounters = episodeEncounters.length > 0 ? episodeEncounters : patientEncounters;
  const alertsInPatient = alertsByPatient.get(encounter.patientId) || [];
  const windowEnd = new Date(encounter.createdAt.getTime() + followUpDays * getDayInMs());
  let hasReconsult = false;
  let hasAdjustment = encounter.hasTreatmentAdjustment;
  let hasFavorableResponse = encounter.hasFavorableResponse;

  for (const candidate of comparableEncounters) {
    if (candidate.createdAt <= encounter.createdAt) continue;
    if (candidate.createdAt > windowEnd) break;

    if (!hasReconsult) {
      hasReconsult = encounter.episode
        ? candidate.episode?.id === encounter.episode.id
        : normalizedCondition
          ? matchesAnalyticsQuery(candidate, source, normalizedCondition)
          : true;
    }

    if (!hasAdjustment && candidate.hasTreatmentAdjustment) {
      hasAdjustment = true;
    }

    if (!hasFavorableResponse && candidate.hasFavorableResponse) {
      hasFavorableResponse = true;
    }
  }

  const relevantProblems = (problemsByPatient.get(encounter.patientId) || []).filter((problem) => {
    if (!problem.resolvedAt || problem.resolvedAt <= encounter.createdAt || problem.resolvedAt > windowEnd) {
      return false;
    }

    const episodeKey = encounter.episode?.key || normalizedCondition;
    if (!episodeKey) {
      return true;
    }

    const normalizedProblem = normalizeConditionName(problem.label);
    return normalizedProblem.includes(episodeKey) || episodeKey.includes(normalizedProblem);
  });

  const hasResolvedProblem = relevantProblems.length > 0;
  const hasAlertAfterIndex = alertsInPatient.some((value) => value > encounter.createdAt && value <= windowEnd);

  return {
    encounterId: encounter.encounterId,
    hasReconsult,
    hasAdjustment,
    hasResolvedProblem,
    hasAlertAfterIndex,
    hasFavorableResponseProxy: hasFavorableResponse || hasResolvedProblem,
  } satisfies EncounterOutcomeEvaluation;
}
