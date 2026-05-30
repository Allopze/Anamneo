import {
  getEncounterConditions,
  type ClinicalTreatmentEntry,
  type ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics.helpers';
import type { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';
import type { RankedMetricRow, EncounterOutcomeEvaluation } from './clinical-analytics-summary.types';
import { ratio } from './clinical-analytics-summary-common.helpers';

type TreatmentOutcomeRow = {
  label: string;
  patientCount: number;
  encounterCount: number;
  favorableCount: number;
  favorableRate: number;
  adjustmentCount: number;
  reconsultCount: number;
  adherenceCount: number;
  adverseEventCount: number;
  subtitle?: string;
};

function buildRankedRows(values: Map<string, RankedMetricRow>, limit: number) {
  return [...values.values()]
    .sort((left, right) => {
      if (right.encounterCount !== left.encounterCount) {
        return right.encounterCount - left.encounterCount;
      }
      return left.label.localeCompare(right.label, 'es');
    })
    .slice(0, limit);
}

function addEntryDetails(details: Set<string>, detail?: string) {
  const normalizedDetail = detail?.trim();
  if (normalizedDetail) {
    details.add(normalizedDetail);
  }
}

function resolveAggregatedSubtitle(details: Set<string>) {
  if (details.size !== 1) {
    return undefined;
  }
  return [...details][0];
}

export function buildTreatmentRanking(
  encounters: ParsedClinicalAnalyticsEncounter[],
  key: 'medications' | 'exams' | 'referrals',
  limit: number,
) {
  const aggregated = new Map<string, RankedMetricRow & { patients: Set<string>; details: Set<string> }>();

  for (const encounter of encounters) {
    const seen = new Set<string>();
    for (const entry of encounter[key] as ClinicalTreatmentEntry[]) {
      if (seen.has(entry.key)) continue;

      seen.add(entry.key);
      const current = aggregated.get(entry.key);
      if (current) {
        current.encounterCount += 1;
        current.patients.add(encounter.patientId);
        addEntryDetails(current.details, entry.details);
        continue;
      }

      aggregated.set(entry.key, {
        label: entry.label,
        encounterCount: 1,
        patientCount: 1,
        patients: new Set([encounter.patientId]),
        details: new Set(entry.details ? [entry.details] : []),
      });
    }
  }

  return buildRankedRows(
    new Map([...aggregated.entries()].map(([keyValue, row]) => [
      keyValue,
      {
        label: row.label,
        encounterCount: row.encounterCount,
        patientCount: row.patients.size,
        subtitle: resolveAggregatedSubtitle(row.details),
      },
    ])),
    limit,
  );
}

export function buildSymptomRanking(
  encounters: ParsedClinicalAnalyticsEncounter[],
  normalizedCondition: string,
  limit: number,
) {
  const aggregated = new Map<string, RankedMetricRow & { patients: Set<string> }>();

  for (const encounter of encounters) {
    const seen = new Set<string>();

    for (const entry of encounter.symptomSignals) {
      if (normalizedCondition && (entry.key.includes(normalizedCondition) || normalizedCondition.includes(entry.key))) {
        continue;
      }
      if (seen.has(entry.key)) continue;

      seen.add(entry.key);
      const current = aggregated.get(entry.key);
      if (current) {
        current.encounterCount += 1;
        current.patients.add(encounter.patientId);
        continue;
      }

      aggregated.set(entry.key, {
        label: entry.label,
        encounterCount: 1,
        patientCount: 1,
        patients: new Set([encounter.patientId]),
      });
    }
  }

  for (const row of aggregated.values()) {
    row.patientCount = row.patients.size;
  }

  return buildRankedRows(new Map([...aggregated.entries()].map(([keyValue, row]) => [keyValue, row])), limit);
}

export function buildFoodRelationRanking(encounters: ParsedClinicalAnalyticsEncounter[]) {
  const meta = [
    { key: 'ASSOCIATED', label: 'Asociado a comida' },
    { key: 'NOT_ASSOCIATED', label: 'No asociado a comida' },
    { key: 'UNSPECIFIED', label: 'Sin dato claro' },
  ] as const;

  const aggregated = new Map<string, RankedMetricRow & { patients: Set<string> }>();

  for (const encounter of encounters) {
    const key = encounter.foodRelation;
    const current = aggregated.get(key);

    if (current) {
      current.encounterCount += 1;
      current.patients.add(encounter.patientId);
      continue;
    }

    const rowMeta = meta.find((entry) => entry.key === key) || meta[2];
    aggregated.set(key, {
      label: rowMeta.label,
      encounterCount: 1,
      patientCount: 1,
      patients: new Set([encounter.patientId]),
    });
  }

  for (const row of aggregated.values()) {
    row.patientCount = row.patients.size;
  }

  return meta
    .map((entry) => aggregated.get(entry.key))
    .filter((entry): entry is RankedMetricRow & { patients: Set<string> } => Boolean(entry))
    .map(({ patients: _patients, ...row }) => row);
}

export function buildTreatmentOutcomeRanking(
  encounters: ParsedClinicalAnalyticsEncounter[],
  evaluations: Map<string, EncounterOutcomeEvaluation>,
  key: 'medications' | 'exams' | 'referrals',
  limit: number,
) {
  const aggregated = new Map<string, TreatmentOutcomeRow & { patients: Set<string>; details: Set<string> }>();

  for (const encounter of encounters) {
    const evaluation = evaluations.get(encounter.encounterId);
    if (!evaluation) continue;

    const seen = new Set<string>();
    for (const entry of encounter[key] as ClinicalTreatmentEntry[]) {
      if (seen.has(entry.key)) continue;

      seen.add(entry.key);
      const current = aggregated.get(entry.key);
      if (current) {
        current.encounterCount += 1;
        current.patients.add(encounter.patientId);
        current.favorableCount += evaluation.hasFavorableResponseProxy ? 1 : 0;
        current.adjustmentCount += evaluation.hasAdjustment ? 1 : 0;
        current.reconsultCount += evaluation.hasReconsult ? 1 : 0;
        current.adherenceCount += entry.adherenceStatus ? 1 : 0;
        current.adverseEventCount += entry.adverseEventSeverity ? 1 : 0;
        addEntryDetails(current.details, entry.details);
        continue;
      }

      aggregated.set(entry.key, {
        label: entry.label,
        encounterCount: 1,
        patientCount: 1,
        favorableCount: evaluation.hasFavorableResponseProxy ? 1 : 0,
        favorableRate: 0,
        adjustmentCount: evaluation.hasAdjustment ? 1 : 0,
        reconsultCount: evaluation.hasReconsult ? 1 : 0,
        adherenceCount: entry.adherenceStatus ? 1 : 0,
        adverseEventCount: entry.adverseEventSeverity ? 1 : 0,
        patients: new Set([encounter.patientId]),
        details: new Set(entry.details ? [entry.details] : []),
      });
    }
  }

  return [...aggregated.values()]
    .map(({ patients, details, ...row }) => ({
      ...row,
      patientCount: patients.size,
      favorableRate: ratio(row.favorableCount, row.encounterCount),
      subtitle: resolveAggregatedSubtitle(details),
    }))
    .sort((left, right) => {
      if (right.favorableCount !== left.favorableCount) return right.favorableCount - left.favorableCount;
      if (right.encounterCount !== left.encounterCount) return right.encounterCount - left.encounterCount;
      return left.label.localeCompare(right.label, 'es');
    })
    .slice(0, limit)
    .map((row) => row);
}

export function buildConditionRanking(
  encounters: ParsedClinicalAnalyticsEncounter[],
  query: ClinicalAnalyticsQueryDto,
) {
  const aggregated = new Map<string, RankedMetricRow & { patients: Set<string> }>();

  for (const encounter of encounters) {
    const seen = new Set<string>();
    for (const entry of getEncounterConditions(encounter, query.source)) {
      const key = `${entry.key}:${entry.code ?? ''}`;
      if (seen.has(key)) continue;

      seen.add(key);
      const current = aggregated.get(key);
      if (current) {
        current.encounterCount += 1;
        current.patients.add(encounter.patientId);
        continue;
      }

      aggregated.set(key, {
        label: entry.label,
        encounterCount: 1,
        patientCount: 1,
        badge: entry.source === 'AFECCION_PROBABLE' ? 'Afección probable' : 'Sospecha diagnóstica',
        subtitle: entry.code ? `CIE10 ${entry.code}` : undefined,
        patients: new Set([encounter.patientId]),
      });
    }
  }

  for (const row of aggregated.values()) {
    row.patientCount = row.patients.size;
  }

  return buildRankedRows(new Map([...aggregated.entries()].map(([keyValue, row]) => [keyValue, row])), query.limit);
}
