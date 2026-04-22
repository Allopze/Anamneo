import { calculateAgeFromBirthDate, extractDateOnlyIso } from '../common/utils/local-date';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import {
  getEncounterConditions,
  matchesAnalyticsQuery,
  type ClinicalTreatmentEntry,
  type ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics.helpers';
import type { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';
import type { RankedMetricRow, ScopedProblem, EncounterOutcomeEvaluation } from './clinical-analytics-summary.types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

export function resolveDefaultFromDate(reference = new Date()) {
  return extractDateOnlyIso(new Date(reference.getTime() - 89 * DAY_IN_MS));
}

export function ratio(partial: number, total: number) {
  return total > 0 ? partial / total : 0;
}

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
      if (seen.has(entry.key)) {
        continue;
      }

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
    new Map([
      ...aggregated.entries(),
    ].map(([keyValue, row]) => [
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
      if (
        normalizedCondition &&
        (entry.key.includes(normalizedCondition) || normalizedCondition.includes(entry.key))
      ) {
        continue;
      }

      if (seen.has(entry.key)) {
        continue;
      }

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
    if (!evaluation) {
      continue;
    }

    const seen = new Set<string>();
    for (const entry of encounter[key] as ClinicalTreatmentEntry[]) {
      if (seen.has(entry.key)) {
        continue;
      }

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
      if (right.favorableCount !== left.favorableCount) {
        return right.favorableCount - left.favorableCount;
      }

      if (right.encounterCount !== left.encounterCount) {
        return right.encounterCount - left.encounterCount;
      }

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
      if (seen.has(key)) {
        continue;
      }

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

export function buildCaveats(hasConditionFilter: boolean) {
  return [
    'Los resultados son descriptivos y observacionales; no prueban efectividad comparativa ni causalidad.',
    'La afección probable y la sospecha diagnóstica no equivalen necesariamente a diagnóstico clínico confirmado.',
    'Los ajustes de tratamiento y la evolución siguen dependiendo en parte de texto libre.',
    'La respuesta favorable proxy se imputa al plan estructurado del encuentro; si hubo varios tratamientos en la misma atención, no se atribuye causalidad a uno solo.',
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
  const windowEnd = new Date(encounter.createdAt.getTime() + followUpDays * DAY_IN_MS);
  let hasReconsult = false;
  let hasAdjustment = encounter.hasTreatmentAdjustment;
  let hasFavorableResponse = encounter.hasFavorableResponse;

  for (const candidate of comparableEncounters) {
    if (candidate.createdAt <= encounter.createdAt) {
      continue;
    }

    if (candidate.createdAt > windowEnd) {
      break;
    }

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
