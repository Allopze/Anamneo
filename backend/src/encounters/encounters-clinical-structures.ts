import { Prisma, PrismaClient } from '@prisma/client';
import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import { PrismaService } from '../prisma/prisma.service';

type EncounterClinicalPrisma = PrismaService | Prisma.TransactionClient;

type EncounterDiagnosisRecord = {
  source: 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
  label: string;
  normalizedLabel: string;
  code?: string | null;
};

type EncounterTreatmentRecord = {
  treatmentType: 'MEDICATION' | 'EXAM' | 'REFERRAL';
  label: string;
  normalizedLabel: string;
  details?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  indication?: string;
  status?: string;
  diagnosisKey?: string;
};

type EncounterOutcomeRecord = {
  treatmentIndex: number;
  status: string;
  source: string;
  notes?: string;
};

type EncounterEpisodeSyncParams = {
  prisma: EncounterClinicalPrisma;
  encounterId: string;
  patientId: string;
  encounterCreatedAt: Date;
  diagnoses: EncounterDiagnosisRecord[];
};

const CLINICAL_STRUCTURE_SECTIONS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
  'RESPUESTA_TRATAMIENTO',
];

function normalizeTreatmentLabel(label: string) {
  return normalizeConditionName(label);
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function syncEncounterEpisode(params: EncounterEpisodeSyncParams) {
  const { prisma, encounterId, patientId, encounterCreatedAt, diagnoses } = params;
  const primaryDiagnosis = diagnoses[0];

  if (!primaryDiagnosis?.normalizedLabel) {
    return;
  }

  const existingEpisode = await prisma.encounterEpisode.findFirst({
    where: {
      patientId,
      normalizedLabel: primaryDiagnosis.normalizedLabel,
      isActive: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (existingEpisode) {
    await prisma.encounterEpisode.update({
      where: { id: existingEpisode.id },
      data: {
        lastEncounterId: encounterId,
        endDate: encounterCreatedAt,
      },
    });

    await prisma.encounter.update({
      where: { id: encounterId },
      data: { episodeId: existingEpisode.id },
    });

    return;
  }

  const createdEpisode = await prisma.encounterEpisode.create({
    data: {
      patientId,
      label: primaryDiagnosis.label,
      normalizedLabel: primaryDiagnosis.normalizedLabel,
      firstEncounterId: encounterId,
      lastEncounterId: encounterId,
      startDate: encounterCreatedAt,
      endDate: encounterCreatedAt,
      isActive: true,
    },
  });

  await prisma.encounter.update({
    where: { id: encounterId },
    data: { episodeId: createdEpisode.id },
  });
}

function getSection<T>(sections: Array<{ sectionKey: string; data: unknown }>, key: SectionKey) {
  return sections.find((section) => section.sectionKey === key) as
    | ({ sectionKey: string; data: T })
    | undefined;
}

function buildEncounterDiagnoses(sections: Array<{ sectionKey: string; data: unknown }>) {
  const probableSection = getSection<{ afeccionSeleccionada?: { name?: string } }>(sections, 'MOTIVO_CONSULTA');
  const diagnosticSection = getSection<{ sospechas?: Array<{ diagnostico?: string; codigoCie10?: string; descripcionCie10?: string }> }>(
    sections,
    'SOSPECHA_DIAGNOSTICA',
  );

  const probableDiagnoses: EncounterDiagnosisRecord[] = [];
  if (probableSection?.data?.afeccionSeleccionada?.name) {
    const label = probableSection.data.afeccionSeleccionada.name.trim();
    if (label) {
      probableDiagnoses.push({
        source: 'AFECCION_PROBABLE',
        label,
        normalizedLabel: normalizeConditionName(label),
        code: null,
      });
    }
  }

  const diagnosticDiagnoses: EncounterDiagnosisRecord[] = [];
  for (const sospecha of diagnosticSection?.data?.sospechas ?? []) {
    const label = ((sospecha.diagnostico || sospecha.descripcionCie10) ?? '').trim();
    const code = sospecha.codigoCie10?.trim() || null;
    if (!label && !code) {
      continue;
    }

    diagnosticDiagnoses.push({
      source: 'SOSPECHA_DIAGNOSTICA',
      label: label || code || 'Diagnóstico sin etiqueta',
      normalizedLabel: normalizeConditionName(label || code || ''),
      code,
    });
  }

  return uniqueBy([...probableDiagnoses, ...diagnosticDiagnoses], (entry) => `${entry.source}:${entry.normalizedLabel}:${entry.code ?? ''}`);
}

function buildEncounterTreatments(
  sections: Array<{ sectionKey: string; data: unknown }>,
  diagnoses: EncounterDiagnosisRecord[],
) {
  const tratamientoSection = getSection<{
    medicamentosEstructurados?: Array<Record<string, unknown>>;
    examenesEstructurados?: Array<Record<string, unknown>>;
    derivacionesEstructuradas?: Array<Record<string, unknown>>;
  }>(sections, 'TRATAMIENTO');

  const diagnosisKey = diagnoses.length === 1 ? diagnoses[0].normalizedLabel : undefined;

  const medicationRows = (tratamientoSection?.data?.medicamentosEstructurados ?? [])
    .map((entry) => {
      const nombre = (entry.nombre as string | undefined)?.trim();
      const activeIngredient = (entry.activeIngredient as string | undefined)?.trim();
      const label = nombre || activeIngredient;
      if (!label) {
        return null;
      }

      const details = [
        entry.dosis,
        entry.via,
        entry.frecuencia,
        entry.duracion,
      ]
        .filter(Boolean)
        .join(' · ')
        .trim();

      return {
        treatmentType: 'MEDICATION' as const,
        label,
        normalizedLabel: normalizeTreatmentLabel(label),
        details: details || undefined,
        dose: (entry.dosis as string | undefined) || undefined,
        route: (entry.via as string | undefined) || undefined,
        frequency: (entry.frecuencia as string | undefined) || undefined,
        duration: (entry.duracion as string | undefined) || undefined,
        indication: (entry.indicacion as string | undefined) || undefined,
        status: undefined,
        diagnosisKey,
      };
    })
    .filter(Boolean) as EncounterTreatmentRecord[];

  const examRows = (tratamientoSection?.data?.examenesEstructurados ?? [])
    .map((entry) => {
      const label = (entry.nombre as string | undefined)?.trim();
      if (!label) {
        return null;
      }

      const details = [entry.estado, entry.indicacion].filter(Boolean).join(' · ').trim();

      return {
        treatmentType: 'EXAM' as const,
        label,
        normalizedLabel: normalizeTreatmentLabel(label),
        details: details || undefined,
        indication: (entry.indicacion as string | undefined) || undefined,
        status: (entry.estado as string | undefined) || undefined,
        diagnosisKey,
      };
    })
    .filter(Boolean) as EncounterTreatmentRecord[];

  const referralRows = (tratamientoSection?.data?.derivacionesEstructuradas ?? [])
    .map((entry) => {
      const label = (entry.nombre as string | undefined)?.trim();
      if (!label) {
        return null;
      }

      const details = [entry.estado, entry.indicacion].filter(Boolean).join(' · ').trim();

      return {
        treatmentType: 'REFERRAL' as const,
        label,
        normalizedLabel: normalizeTreatmentLabel(label),
        details: details || undefined,
        indication: (entry.indicacion as string | undefined) || undefined,
        status: (entry.estado as string | undefined) || undefined,
        diagnosisKey,
      };
    })
    .filter(Boolean) as EncounterTreatmentRecord[];

  return [...medicationRows, ...examRows, ...referralRows];
}

function buildEncounterOutcome(
  sections: Array<{ sectionKey: string; data: unknown }>,
  treatments: EncounterTreatmentRecord[],
) {
  const respuestaSection = getSection<{
    respuestaEstructurada?: { estado?: string; notas?: string };
    evolucion?: string;
    resultadosExamenes?: string;
    ajustesTratamiento?: string;
    planSeguimiento?: string;
  }>(sections, 'RESPUESTA_TRATAMIENTO');

  const structuredStatus = respuestaSection?.data?.respuestaEstructurada?.estado;
  const textNotes = [
    respuestaSection?.data?.respuestaEstructurada?.notas,
    respuestaSection?.data?.evolucion,
    respuestaSection?.data?.resultadosExamenes,
  ]
    .filter(Boolean)
    .join(' \n')
    .trim();

  const status = structuredStatus ?? (textNotes ? 'UNKNOWN' : 'UNKNOWN');
  const source = structuredStatus ? 'ESTRUCTURADO' : textNotes ? 'TEXTO' : 'UNKNOWN';

  return treatments.map((_, index) => ({
    treatmentIndex: index,
    status,
    source,
    notes: textNotes || undefined,
  }));
}

export async function syncEncounterClinicalStructures(params: {
  prisma: EncounterClinicalPrisma;
  encounterId: string;
}) {
  const { prisma, encounterId } = params;

  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: {
      patientId: true,
      createdAt: true,
    },
  });

  if (!encounter) {
    return;
  }

  const sections = await prisma.encounterSection.findMany({
    where: { encounterId },
    orderBy: { sectionKey: 'asc' },
  });

  if (sections.length === 0) {
    return;
  }

  const normalizedSections = sections.map((section) => formatEncounterSectionForRead(section));
  const diagnoses = buildEncounterDiagnoses(normalizedSections);
  const treatments = buildEncounterTreatments(normalizedSections, diagnoses);
  const outcomes = buildEncounterOutcome(normalizedSections, treatments);

  await prisma.encounterTreatmentOutcome.deleteMany({
    where: {
      encounterTreatment: {
        encounterId,
      },
    },
  });
  await prisma.encounterTreatment.deleteMany({ where: { encounterId } });
  await prisma.encounterDiagnosis.deleteMany({ where: { encounterId } });

  const createdDiagnoses = await Promise.all(
    diagnoses.map((diagnosis) =>
      prisma.encounterDiagnosis.create({
        data: {
          encounterId,
          source: diagnosis.source,
          label: diagnosis.label,
          normalizedLabel: diagnosis.normalizedLabel,
          code: diagnosis.code ?? null,
        },
      }),
    ),
  );

  const diagnosisIdByKey = new Map<string, string>();
  for (const record of createdDiagnoses) {
    diagnosisIdByKey.set(record.normalizedLabel, record.id);
  }

  const createdTreatments = await Promise.all(
    treatments.map((treatment) =>
      prisma.encounterTreatment.create({
        data: {
          encounterId,
          diagnosisId: treatment.diagnosisKey ? diagnosisIdByKey.get(treatment.diagnosisKey) ?? undefined : undefined,
          treatmentType: treatment.treatmentType,
          label: treatment.label,
          normalizedLabel: treatment.normalizedLabel,
          details: treatment.details,
          dose: treatment.dose,
          route: treatment.route,
          frequency: treatment.frequency,
          duration: treatment.duration,
          indication: treatment.indication,
          status: treatment.status,
        },
      }),
    ),
  );

  await Promise.all(
    outcomes.map((outcome) =>
      prisma.encounterTreatmentOutcome.create({
        data: {
          encounterTreatmentId: createdTreatments[outcome.treatmentIndex]?.id,
          outcomeStatus: outcome.status,
          outcomeSource: outcome.source,
          notes: outcome.notes ?? null,
        },
      }),
    ),
  );

  await syncEncounterEpisode({
    prisma,
    encounterId,
    patientId: encounter.patientId,
    encounterCreatedAt: encounter.createdAt,
    diagnoses,
  });
}

export function shouldSyncEncounterClinicalStructures(sectionKey: SectionKey) {
  return CLINICAL_STRUCTURE_SECTIONS.includes(sectionKey);
}
