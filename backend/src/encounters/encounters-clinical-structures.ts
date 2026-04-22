import { Prisma } from '@prisma/client';
import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { PrismaService } from '../prisma/prisma.service';
import { reconcileEncounterEpisode } from './encounters-episodes';
import {
  buildEncounterDiagnoses,
  buildEncounterOutcome,
  buildEncounterTreatments,
} from './encounters-clinical-structures.helpers';

type EncounterClinicalPrisma = PrismaService | Prisma.TransactionClient;

const CLINICAL_STRUCTURE_SECTIONS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
  'RESPUESTA_TRATAMIENTO',
];

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
  const diagnosisIdBySourceEntryId = new Map<string, string>();
  for (const [index, record] of createdDiagnoses.entries()) {
    diagnosisIdByKey.set(record.normalizedLabel, record.id);
    const sourceEntryId = diagnoses[index]?.sourceEntryId;
    if (sourceEntryId) {
      diagnosisIdBySourceEntryId.set(sourceEntryId, record.id);
    }
  }

  const createdTreatments = await Promise.all(
    treatments.map((treatment) =>
      prisma.encounterTreatment.create({
        data: {
          encounterId,
          diagnosisId:
            (treatment.diagnosisSourceEntryId
              ? diagnosisIdBySourceEntryId.get(treatment.diagnosisSourceEntryId)
              : undefined) ??
            (treatment.diagnosisKey ? diagnosisIdByKey.get(treatment.diagnosisKey) : undefined) ??
            undefined,
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
          adherenceStatus: outcome.adherenceStatus ?? null,
          adverseEventSeverity: outcome.adverseEventSeverity ?? null,
          adverseEventNotes: outcome.adverseEventNotes ?? null,
        },
      }),
    ),
  );

  await reconcileEncounterEpisode({
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
