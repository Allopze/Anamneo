import { BadRequestException } from '@nestjs/common';
import { endOfAppDayUtcExclusive, extractDateOnlyIso, startOfAppDayUtc, todayLocalDateOnly } from '../common/utils/local-date';
import { getEffectiveMedicoId, type RequestUser } from '../common/utils/medico-id';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildClinicalAnalyticsEncounterFromPersistence,
  getEncounterConditions,
  matchesAnalyticsQuery,
  type FoodRelation,
  type ParsedClinicalAnalyticsEncounter,
} from './clinical-analytics.helpers';
import type {
  ClinicalAnalyticsCaseFocusType,
  ClinicalAnalyticsCasesQueryDto,
} from './dto/clinical-analytics-cases-query.dto';

const ANALYTICS_STATUSES = ['COMPLETADO', 'FIRMADO'] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type AnalyticsCasesRawEncounter = {
  id: string;
  patientId: string;
  status: string;
  createdAt: Date;
  patient: {
    id: string;
    nombre: string | null;
    rut: string | null;
    edad: number | null;
    sexo: string | null;
    prevision: string | null;
  };
  sections: Array<{
    sectionKey: string;
    data: unknown;
    schemaVersion?: number | null;
  }>;
};

function resolveDefaultFromDate(reference = new Date()) {
  return extractDateOnlyIso(new Date(reference.getTime() - 89 * DAY_IN_MS));
}

function localizeFoodRelation(value: FoodRelation) {
  if (value === 'ASSOCIATED') {
    return 'Asociado a comida';
  }

  if (value === 'NOT_ASSOCIATED') {
    return 'No asociado a comida';
  }

  return 'Sin dato claro';
}

function matchesCasesFocus(
  encounter: ParsedClinicalAnalyticsEncounter,
  focusType: ClinicalAnalyticsCaseFocusType | undefined,
  normalizedFocusValue: string,
) {
  if (!focusType || !normalizedFocusValue) {
    return true;
  }

  if (focusType === 'MEDICATION') {
    return encounter.medications.some((entry) => entry.key.includes(normalizedFocusValue));
  }

  return encounter.symptomSignals.some((entry) => entry.key.includes(normalizedFocusValue));
}

function uniqueLabels(values: Array<{ label: string }>) {
  return [...new Set(values.map((value) => value.label))];
}

export async function getClinicalAnalyticsCasesReadModel(params: {
  prisma: PrismaService;
  user: RequestUser;
  query: ClinicalAnalyticsCasesQueryDto;
}) {
  const { prisma, user, query } = params;
  const effectiveMedicoId = getEffectiveMedicoId(user);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 15;
  const toDate = extractDateOnlyIso(query.toDate ?? todayLocalDateOnly());
  const fromDate = extractDateOnlyIso(query.fromDate ?? resolveDefaultFromDate());
  const fromStart = startOfAppDayUtc(fromDate);
  const toEndExclusive = endOfAppDayUtcExclusive(toDate);

  if (fromStart >= toEndExclusive) {
    throw new BadRequestException('La fecha desde debe ser anterior o igual a la fecha hasta');
  }

  const rawEncounters = await prisma.encounter.findMany({
    where: {
      medicoId: effectiveMedicoId,
      status: { in: [...ANALYTICS_STATUSES] },
      createdAt: { gte: fromStart, lt: toEndExclusive },
      patient: { archivedAt: null },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      patient: {
        select: {
          id: true,
          nombre: true,
          rut: true,
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

  const normalizedCondition = query.condition ? normalizeConditionName(query.condition) : '';
  const normalizedFocusValue = query.focusValue ? normalizeConditionName(query.focusValue) : '';

  const matchedEncounters = rawEncounters
    .map((rawEncounter) => ({
      rawEncounter,
      parsedEncounter: buildClinicalAnalyticsEncounterFromPersistence(rawEncounter as any),
    }))
    .filter(({ parsedEncounter }) => matchesAnalyticsQuery(parsedEncounter, query.source, normalizedCondition))
    .filter(({ parsedEncounter }) => matchesCasesFocus(parsedEncounter, query.focusType, normalizedFocusValue));

  const total = matchedEncounters.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  return {
    filters: {
      condition: query.condition?.trim() || null,
      source: query.source,
      fromDate,
      toDate,
      followUpDays: query.followUpDays ?? 30,
    },
    focus: {
      type: query.focusType ?? null,
      value: query.focusValue?.trim() || null,
    },
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
    data: matchedEncounters.slice(startIndex, startIndex + pageSize).map(({ rawEncounter, parsedEncounter }) => ({
      encounterId: rawEncounter.id,
      patientId: rawEncounter.patientId,
      episodeId: parsedEncounter.episode?.id ?? null,
      episodeLabel: parsedEncounter.episode?.label ?? null,
      episodeStartDate: parsedEncounter.episode?.startDate ?? null,
      episodeEndDate: parsedEncounter.episode?.endDate ?? null,
      episodeIsActive: parsedEncounter.episode?.isActive ?? null,
      patientName: rawEncounter.patient.nombre,
      patientRut: rawEncounter.patient.rut,
      createdAt: rawEncounter.createdAt,
      status: rawEncounter.status,
      patientAge: rawEncounter.patient.edad,
      patientSex: rawEncounter.patient.sexo,
      patientPrevision: rawEncounter.patient.prevision,
      conditions: uniqueLabels(getEncounterConditions(parsedEncounter, 'ANY')),
      diagnoses: uniqueLabels(parsedEncounter.diagnoses),
      medications: uniqueLabels(parsedEncounter.medications),
      exams: uniqueLabels(parsedEncounter.exams),
      referrals: uniqueLabels(parsedEncounter.referrals),
      symptoms: uniqueLabels(parsedEncounter.symptomSignals),
      foodRelation: localizeFoodRelation(parsedEncounter.foodRelation),
      outcomeStatus: parsedEncounter.outcome.status,
      outcomeSource: parsedEncounter.outcome.source,
      adherenceStatus: parsedEncounter.outcome.adherenceStatus ?? null,
      adverseEventSeverity: parsedEncounter.outcome.adverseEventSeverity ?? null,
      hasTreatmentAdjustment: parsedEncounter.hasTreatmentAdjustment,
      hasFavorableResponse: parsedEncounter.hasFavorableResponse,
      hasAdverseEvent: parsedEncounter.hasAdverseEvent,
    })),
  };
}