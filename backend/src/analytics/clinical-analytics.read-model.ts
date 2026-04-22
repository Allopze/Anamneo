import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPatientProblemScopeWhere } from '../common/utils/patient-access';
import { endOfAppDayUtcExclusive, extractDateOnlyIso, startOfAppDayUtc, todayLocalDateOnly } from '../common/utils/local-date';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import {
  buildClinicalAnalyticsEncounterFromPersistence,
  matchesAnalyticsQuery,
  type ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics.helpers';
import {
  buildCaveats,
  buildConditionRanking,
  buildFoodRelationRanking,
  buildSymptomRanking,
  buildTreatmentOutcomeRanking,
  buildTreatmentRanking,
  calculateAverageAge,
  evaluateEncounterOutcome,
  ratio,
  resolveDefaultFromDate,
  type ScopedProblem,
} from './clinical-analytics-summary';
import type { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';

const ANALYTICS_STATUSES = ['COMPLETADO', 'FIRMADO'] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function buildPatientLevelAlertScopeWhere(effectiveMedicoId: string) {
  return {
    encounterId: null,
    OR: [
      { createdById: effectiveMedicoId },
      { createdBy: { medicoId: effectiveMedicoId } },
    ],
  };
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
  const fromStart = startOfAppDayUtc(fromDate);
  const toEndExclusive = endOfAppDayUtcExclusive(toDate);

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
      diagnoses: {
        select: {
          source: true,
          label: true,
          normalizedLabel: true,
          code: true,
        },
      },
      treatments: {
        select: {
          treatmentType: true,
          label: true,
          normalizedLabel: true,
          details: true,
          dose: true,
          route: true,
          frequency: true,
          duration: true,
          indication: true,
          status: true,
          diagnosis: {
            select: { label: true, normalizedLabel: true },
          },
          outcomes: {
            select: {
              outcomeStatus: true,
              outcomeSource: true,
              notes: true,
              adherenceStatus: true,
              adverseEventSeverity: true,
              adverseEventNotes: true,
            },
          },
        },
      },
      episode: {
        select: {
          id: true,
          label: true,
          normalizedLabel: true,
          startDate: true,
          endDate: true,
          isActive: true,
        },
      },
    },
  });

  const parsedEncounters = rawEncounters.map((rawEncounter) =>
    buildClinicalAnalyticsEncounterFromPersistence(rawEncounter as any),
  );
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
              buildPatientLevelAlertScopeWhere(effectiveMedicoId),
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

  const encountersByEpisode = new Map<string, ParsedClinicalAnalyticsEncounter[]>();
  for (const encounter of parsedEncounters) {
    if (!encounter.episode) {
      continue;
    }

    const current = encountersByEpisode.get(encounter.episode.id) || [];
    current.push(encounter);
    encountersByEpisode.set(encounter.episode.id, current);
  }

  const evaluations = matchedEncounters.map((encounter) => evaluateEncounterOutcome({
    encounter,
    encountersByPatient,
    encountersByEpisode,
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
  const adherenceDocumentedCount = matchedEncounters.filter((entry) => entry.hasDocumentedAdherence).length;
  const adverseEventCount = matchedEncounters.filter((entry) => entry.hasAdverseEvent).length;

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
      adherenceDocumentedCount,
      adherenceDocumentedRate: ratio(adherenceDocumentedCount, matchedEncounters.length),
      adverseEventCount,
      adverseEventRate: ratio(adverseEventCount, matchedEncounters.length),
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
      medications: buildTreatmentOutcomeRanking(matchedEncounters, evaluationByEncounterId, 'medications', limit),
      exams: buildTreatmentOutcomeRanking(matchedEncounters, evaluationByEncounterId, 'exams', limit),
      referrals: buildTreatmentOutcomeRanking(matchedEncounters, evaluationByEncounterId, 'referrals', limit),
    },
    outcomeProxies: {
      reconsultWithinWindowRate: ratio(reconsultCount, matchedEncounters.length),
      treatmentAdjustmentRate: ratio(adjustmentCount, matchedEncounters.length),
      resolvedProblemRate: ratio(resolvedProblemCount, matchedEncounters.length),
      alertAfterIndexRate: ratio(alertAfterIndexCount, matchedEncounters.length),
    },
  };
}
