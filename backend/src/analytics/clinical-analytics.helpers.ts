import type { ClinicalAnalyticsSource } from './dto/clinical-analytics-query.dto';
import {
  findSymptomDefinitionForQuery,
  includesAnyNonNegated,
} from './clinical-analytics-text';
import {
  buildClinicalAnalyticsEncounter,
  buildClinicalAnalyticsEncounterFromPersistence,
  type ClinicalConditionEntry,
  type EncounterDiagnosisEntry,
  type ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics-encounter';

export type {
  ClinicalConditionEntry,
  ClinicalTreatmentEntry,
  EncounterDiagnosisEntry,
  FoodRelation,
  ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics-encounter';

export function getEncounterConditions(
  encounter: Pick<ParsedClinicalAnalyticsEncounter, 'probableConditions' | 'diagnosticConditions'> & { diagnoses?: EncounterDiagnosisEntry[] },
  source: ClinicalAnalyticsSource,
) {
  const probableConditions = encounter.probableConditions.length > 0
    ? encounter.probableConditions
    : (encounter.diagnoses ?? []).filter(
        (entry): entry is ClinicalConditionEntry => entry.source === 'AFECCION_PROBABLE',
      );

  const diagnosticConditions = encounter.diagnosticConditions.length > 0
    ? encounter.diagnosticConditions
    : (encounter.diagnoses ?? []).filter(
        (entry): entry is ClinicalConditionEntry => entry.source === 'SOSPECHA_DIAGNOSTICA',
      );

  if (source === 'AFECCION_PROBABLE') {
    return probableConditions;
  }

  if (source === 'SOSPECHA_DIAGNOSTICA') {
    return diagnosticConditions;
  }

  const seen = new Set<string>();
  return [...probableConditions, ...diagnosticConditions].filter((entry) => {
    const key = `${entry.key}:${entry.code ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function matchesAnalyticsCondition(entries: ClinicalConditionEntry[], normalizedCondition: string) {
  if (!normalizedCondition) {
    return true;
  }

  return entries.some((entry) => entry.key.includes(normalizedCondition) || entry.code?.toLowerCase().includes(normalizedCondition));
}

export function matchesAnalyticsQuery(
  encounter: Pick<ParsedClinicalAnalyticsEncounter, 'probableConditions' | 'diagnosticConditions' | 'searchableText' | 'symptomSignals'> & { diagnoses?: EncounterDiagnosisEntry[] },
  source: ClinicalAnalyticsSource,
  normalizedCondition: string,
) {
  if (!normalizedCondition) {
    return true;
  }

  if (matchesAnalyticsCondition(getEncounterConditions(encounter, source), normalizedCondition)) {
    return true;
  }

  if (source !== 'ANY') {
    return false;
  }

  if (encounter.symptomSignals.some((entry) => entry.key.includes(normalizedCondition))) {
    return true;
  }

  const symptomDefinition = findSymptomDefinitionForQuery(normalizedCondition);
  if (symptomDefinition) {
    return includesAnyNonNegated(
      encounter.searchableText,
      [...new Set([symptomDefinition.key, ...symptomDefinition.patterns])],
    );
  }

  return encounter.searchableText.includes(normalizedCondition);
}
export { buildClinicalAnalyticsEncounter, buildClinicalAnalyticsEncounterFromPersistence };
