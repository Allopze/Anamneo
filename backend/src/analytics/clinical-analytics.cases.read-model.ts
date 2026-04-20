import { BadRequestException } from '@nestjs/common';
import { extractDateOnlyIso, startOfUtcDay, todayLocalDateOnly } from '../common/utils/local-date';
import { getEffectiveMedicoId, type RequestUser } from '../common/utils/medico-id';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildClinicalAnalyticsEncounter,
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
  const fromStart = startOfUtcDay(fromDate);
  const toEndExclusive = new Date(startOfUtcDay(toDate).getTime() + DAY_IN_MS);

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
    },
  });

  const normalizedCondition = query.condition ? normalizeConditionName(query.condition) : '';
  const normalizedFocusValue = query.focusValue ? normalizeConditionName(query.focusValue) : '';

  const matchedEncounters = (rawEncounters as AnalyticsCasesRawEncounter[])
    .map((rawEncounter) => ({
      rawEncounter,
      parsedEncounter: buildClinicalAnalyticsEncounter(rawEncounter),
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
      patientName: rawEncounter.patient.nombre,
      patientRut: rawEncounter.patient.rut,
      createdAt: rawEncounter.createdAt,
      status: rawEncounter.status,
      patientAge: rawEncounter.patient.edad,
      patientSex: rawEncounter.patient.sexo,
      patientPrevision: rawEncounter.patient.prevision,
      conditions: uniqueLabels(getEncounterConditions(parsedEncounter, 'ANY')),
      medications: uniqueLabels(parsedEncounter.medications),
      symptoms: uniqueLabels(parsedEncounter.symptomSignals),
      foodRelation: localizeFoodRelation(parsedEncounter.foodRelation),
      hasTreatmentAdjustment: parsedEncounter.hasTreatmentAdjustment,
      hasFavorableResponse: parsedEncounter.hasFavorableResponse,
    })),
  };
}