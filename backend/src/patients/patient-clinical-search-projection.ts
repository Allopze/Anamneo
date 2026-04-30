import { parseStoredJson } from '../common/utils/encounter-sections';
import type { SectionKey } from '../common/types';
import type { PrismaService } from '../prisma/prisma.service';

export const PATIENT_CLINICAL_SEARCH_SECTION_KEYS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'ANAMNESIS_PROXIMA',
  'REVISION_SISTEMAS',
];

export function shouldSyncPatientClinicalSearch(sectionKey: SectionKey) {
  return PATIENT_CLINICAL_SEARCH_SECTION_KEYS.includes(sectionKey);
}

function normalizeClinicalSearchText(rawData: unknown) {
  const parsed = parseStoredJson<unknown>(rawData, null);
  if (parsed === null || parsed === undefined) {
    return '';
  }

  if (Array.isArray(parsed) && parsed.length === 0) {
    return '';
  }

  if (typeof parsed === 'object' && JSON.stringify(parsed) === '{}') {
    return '';
  }

  return JSON.stringify(parsed).toLowerCase();
}

export async function rebuildPatientClinicalSearchProjection(
  prisma: PrismaService,
  params: { patientId: string; medicoId: string },
) {
  const encounters = await prisma.encounter.findMany({
    where: {
      patientId: params.patientId,
      medicoId: params.medicoId,
    },
    select: {
      sections: {
        where: {
          sectionKey: { in: PATIENT_CLINICAL_SEARCH_SECTION_KEYS },
        },
        select: { data: true },
      },
    },
  });

  const text = encounters
    .flatMap((encounter) => encounter.sections)
    .map((section) => normalizeClinicalSearchText(section.data))
    .filter(Boolean)
    .join('\n');

  if (!text.trim()) {
    await prisma.patientClinicalSearch.deleteMany({
      where: {
        patientId: params.patientId,
        medicoId: params.medicoId,
      },
    });
    return;
  }

  await prisma.patientClinicalSearch.upsert({
    where: {
      patientId_medicoId: {
        patientId: params.patientId,
        medicoId: params.medicoId,
      },
    },
    create: {
      patientId: params.patientId,
      medicoId: params.medicoId,
      text,
    },
    update: {
      text,
    },
  });
}
