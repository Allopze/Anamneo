import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPatientProblemScopeWhere } from '../common/utils/patient-access';
import { calculateAgeFromBirthDate, extractDateOnlyIso, startOfUtcDay, todayLocalDateOnly } from '../common/utils/local-date';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import {
  buildClinicalAnalyticsEncounter,
  getEncounterConditions,
  matchesAnalyticsQuery,
  type ClinicalTreatmentEntry,
  type ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics.helpers';
import type { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';

const ANALYTICS_STATUSES = ['COMPLETADO', 'FIRMADO'] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type RankedMetricRow = {
  label: string;
  encounterCount: number;
  patientCount: number;
  badge?: string;
  subtitle?: string;
};

type ScopedProblem = {
  patientId: string;
  label: string;
  resolvedAt: Date | null;
};

type EncounterOutcomeEvaluation = {
  encounterId: string;
  hasReconsult: boolean;
  hasAdjustment: boolean;
  hasResolvedProblem: boolean;
  hasAlertAfterIndex: boolean;
  hasFavorableResponseProxy: boolean;
};

type TreatmentOutcomeRow = {
  label: string;
  patientCount: number;
  encounterCount: number;
  favorableCount: number;
  favorableRate: number;
  adjustmentCount: number;
  reconsultCount: number;
  subtitle?: string;
};

function resolveDefaultFromDate(reference = new Date()) {
  return extractDateOnlyIso(new Date(reference.getTime() - 89 * DAY_IN_MS));
}

function ratio(partial: number, total: number) {
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

function buildTreatmentRanking(encounters: ParsedClinicalAnalyticsEncounter[], key: 'medications' | 'exams' | 'referrals', limit: number) {
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

  return buildRankedRows(new Map([...aggregated.entries()].map(([keyValue, row]) => [keyValue, {
    label: row.label,
    encounterCount: row.encounterCount,
    patientCount: row.patients.size,
    subtitle: resolveAggregatedSubtitle(row.details),
  }])), limit);
}

function buildSymptomRanking(encounters: ParsedClinicalAnalyticsEncounter[], normalizedCondition: string, limit: number) {
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

function buildFoodRelationRanking(encounters: ParsedClinicalAnalyticsEncounter[]) {
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

function buildTreatmentOutcomeRanking(
  encounters: ParsedClinicalAnalyticsEncounter[],
  evaluations: Map<string, EncounterOutcomeEvaluation>,
  limit: number,
) {
  const aggregated = new Map<string, TreatmentOutcomeRow & { patients: Set<string>; details: Set<string> }>();

  for (const encounter of encounters) {
    const evaluation = evaluations.get(encounter.encounterId);
    if (!evaluation) {
      continue;
    }

    const seen = new Set<string>();
    for (const entry of encounter.medications as ClinicalTreatmentEntry[]) {
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

function buildConditionRanking(encounters: ParsedClinicalAnalyticsEncounter[], query: ClinicalAnalyticsQueryDto) {
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

function buildCaveats(hasConditionFilter: boolean) {
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

function calculateAverageAge(encounters: ParsedClinicalAnalyticsEncounter[]) {
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

function evaluateEncounterOutcome(params: {
  encounter: ParsedClinicalAnalyticsEncounter;
  encountersByPatient: Map<string, ParsedClinicalAnalyticsEncounter[]>;
  alertsByPatient: Map<string, Date[]>;
  problemsByPatient: Map<string, ScopedProblem[]>;
  normalizedCondition: string;
  source: ClinicalAnalyticsQueryDto['source'];
  followUpDays: number;
}) {
  const {
    encounter,
    encountersByPatient,
    alertsByPatient,
    problemsByPatient,
    normalizedCondition,
    source,
    followUpDays,
  } = params;

  const patientEncounters = encountersByPatient.get(encounter.patientId) || [];
  const alertsInPatient = alertsByPatient.get(encounter.patientId) || [];
  const windowEnd = new Date(encounter.createdAt.getTime() + followUpDays * DAY_IN_MS);
  let hasReconsult = false;
  let hasAdjustment = encounter.hasTreatmentAdjustment;
  let hasFavorableResponse = encounter.hasFavorableResponse;

  for (const candidate of patientEncounters) {
    if (candidate.createdAt <= encounter.createdAt) {
      continue;
    }

    if (candidate.createdAt > windowEnd) {
      break;
    }

    if (!hasReconsult) {
      hasReconsult = normalizedCondition
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

    return !normalizedCondition || normalizeConditionName(problem.label).includes(normalizedCondition);
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

export async function getClinicalAnalyticsSummaryReadModel(params: {
  prisma: PrismaService;
  user: RequestUser;
  query: ClinicalAnalyticsQueryDto;
}) {
  const { prisma, user, query } = params;
  const effectiveMedicoId = getEffectiveMedicoId(user);
  const followUpDays = query.followUpDays ?? 30;
  const limit = query.limit ?? 10;
  const toDate = extractDateOnlyIso(query.toDate ?? todayLocalDateOnly());
  const fromDate = extractDateOnlyIso(query.fromDate ?? resolveDefaultFromDate());
  const fromStart = startOfUtcDay(fromDate);
  const toEndExclusive = new Date(startOfUtcDay(toDate).getTime() + DAY_IN_MS);

  if (fromStart >= toEndExclusive) {
    throw new BadRequestException('La fecha desde debe ser anterior o igual a la fecha hasta');
  }

  const extendedEnd = new Date(toEndExclusive.getTime() + followUpDays * DAY_IN_MS);
  const rawEncounters = await prisma.encounter.findMany({
    where: {
      medicoId: effectiveMedicoId,
      status: { in: [...ANALYTICS_STATUSES] },
      createdAt: { gte: fromStart, lt: extendedEnd },
      patient: { archivedAt: null },
    },
    orderBy: [{ patientId: 'asc' }, { createdAt: 'asc' }],
    include: {
      patient: {
        select: {
          id: true,
          fechaNacimiento: true,
          edad: true,
          sexo: true,
          prevision: true,
        },
      },
      sections: {
        select: {
          sectionKey: true,
          data: true,
          schemaVersion: true,
        },
      },
    },
  });

  const parsedEncounters = rawEncounters.map(buildClinicalAnalyticsEncounter);
  const baseEncounters = parsedEncounters.filter((entry) => entry.createdAt >= fromStart && entry.createdAt < toEndExclusive);
  const normalizedCondition = query.condition ? normalizeConditionName(query.condition) : '';
  const matchedEncounters = baseEncounters.filter((entry) => matchesAnalyticsQuery(entry, query.source, normalizedCondition));
  const patientIds = [...new Set(matchedEncounters.map((entry) => entry.patientId))];

  const [problems, alerts] = patientIds.length > 0
    ? await Promise.all([
        prisma.patientProblem.findMany({
          where: {
            patientId: { in: patientIds },
            ...buildPatientProblemScopeWhere(effectiveMedicoId),
          },
          select: {
            patientId: true,
            label: true,
            resolvedAt: true,
          },
        }),
        prisma.clinicalAlert.findMany({
          where: {
            patientId: { in: patientIds },
            createdAt: { gte: fromStart, lt: extendedEnd },
            OR: [
              { encounterId: null },
              { encounter: { medicoId: effectiveMedicoId } },
            ],
          },
          select: {
            patientId: true,
            createdAt: true,
          },
        }),
      ])
    : [[], []];

  const problemsByPatient = new Map<string, ScopedProblem[]>();
  for (const problem of problems) {
    const current = problemsByPatient.get(problem.patientId) || [];
    current.push(problem);
    problemsByPatient.set(problem.patientId, current);
  }

  const alertsByPatient = new Map<string, Date[]>();
  for (const alert of alerts) {
    const current = alertsByPatient.get(alert.patientId) || [];
    current.push(alert.createdAt);
    alertsByPatient.set(alert.patientId, current);
  }

  const encountersByPatient = new Map<string, ParsedClinicalAnalyticsEncounter[]>();
  for (const encounter of parsedEncounters) {
    const current = encountersByPatient.get(encounter.patientId) || [];
    current.push(encounter);
    encountersByPatient.set(encounter.patientId, current);
  }

  const evaluations = matchedEncounters.map((encounter) => evaluateEncounterOutcome({
    encounter,
    encountersByPatient,
    alertsByPatient,
    problemsByPatient,
    normalizedCondition,
    source: query.source,
    followUpDays,
  }));
  const evaluationByEncounterId = new Map(evaluations.map((entry) => [entry.encounterId, entry]));
  const reconsultCount = evaluations.filter((entry) => entry.hasReconsult).length;
  const adjustmentCount = evaluations.filter((entry) => entry.hasAdjustment).length;
  const resolvedProblemCount = evaluations.filter((entry) => entry.hasResolvedProblem).length;
  const alertAfterIndexCount = evaluations.filter((entry) => entry.hasAlertAfterIndex).length;

  const uniquePatients = new Map<string, ParsedClinicalAnalyticsEncounter['patient']>();
  for (const encounter of matchedEncounters) {
    uniquePatients.set(encounter.patientId, encounter.patient);
  }

  const patientList = [...uniquePatients.values()];

  const demographics = {
    averageAge: calculateAverageAge(matchedEncounters),
    bySex: patientList.reduce<Record<string, number>>((accumulator, patient) => {
      const key = patient.sexo?.trim() || 'SIN_DATO';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
  };

  return {
    filters: {
      condition: query.condition?.trim() || null,
      source: query.source,
      fromDate,
      toDate,
      followUpDays,
      limit,
    },
    caveats: buildCaveats(Boolean(normalizedCondition)),
    summary: {
      matchedPatients: uniquePatients.size,
      matchedEncounters: matchedEncounters.length,
      structuredTreatmentCount: matchedEncounters.filter((entry) => entry.hasStructuredTreatment).length,
      structuredTreatmentCoverage: ratio(matchedEncounters.filter((entry) => entry.hasStructuredTreatment).length, matchedEncounters.length),
      reconsultWithinWindowCount: reconsultCount,
      reconsultWithinWindowRate: ratio(reconsultCount, matchedEncounters.length),
      treatmentAdjustmentCount: adjustmentCount,
      treatmentAdjustmentRate: ratio(adjustmentCount, matchedEncounters.length),
      resolvedProblemCount: resolvedProblemCount,
      resolvedProblemRate: ratio(resolvedProblemCount, matchedEncounters.length),
      alertAfterIndexCount: alertAfterIndexCount,
      alertAfterIndexRate: ratio(alertAfterIndexCount, matchedEncounters.length),
      demographics,
    },
    topConditions: buildConditionRanking(normalizedCondition ? matchedEncounters : baseEncounters, query),
    cohortBreakdown: {
      associatedSymptoms: buildSymptomRanking(matchedEncounters, normalizedCondition, limit),
      foodRelation: buildFoodRelationRanking(matchedEncounters),
    },
    treatmentPatterns: {
      medications: buildTreatmentRanking(matchedEncounters, 'medications', limit),
      exams: buildTreatmentRanking(matchedEncounters, 'exams', limit),
      referrals: buildTreatmentRanking(matchedEncounters, 'referrals', limit),
    },
    treatmentOutcomeProxies: {
      medications: buildTreatmentOutcomeRanking(matchedEncounters, evaluationByEncounterId, limit),
    },
    outcomeProxies: {
      reconsultWithinWindowRate: ratio(reconsultCount, matchedEncounters.length),
      treatmentAdjustmentRate: ratio(adjustmentCount, matchedEncounters.length),
      resolvedProblemRate: ratio(resolvedProblemCount, matchedEncounters.length),
      alertAfterIndexRate: ratio(alertAfterIndexCount, matchedEncounters.length),
    },
  };
}