import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type EncounterEpisodePrisma = PrismaService | Prisma.TransactionClient;

type EncounterEpisodeDiagnosis = {
  label: string;
  normalizedLabel: string;
};

function getPrimaryEpisodeDiagnosis(diagnoses: EncounterEpisodeDiagnosis[]) {
  return diagnoses.find((diagnosis) => diagnosis.normalizedLabel.trim().length > 0);
}

async function recomputeEncounterEpisodeWindow(prisma: EncounterEpisodePrisma, episodeId: string) {
  const linkedEncounters = await prisma.encounter.findMany({
    where: {
      episodeId,
      status: { not: 'CANCELADO' },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      createdAt: true,
    },
  });

  if (linkedEncounters.length === 0) {
    await prisma.encounterEpisode.update({
      where: { id: episodeId },
      data: {
        firstEncounterId: null,
        lastEncounterId: null,
        startDate: null,
        endDate: null,
        isActive: false,
      },
    });
    return;
  }

  const firstEncounter = linkedEncounters[0];
  const lastEncounter = linkedEncounters[linkedEncounters.length - 1];

  await prisma.encounterEpisode.update({
    where: { id: episodeId },
    data: {
      firstEncounterId: firstEncounter.id,
      lastEncounterId: lastEncounter.id,
      startDate: firstEncounter.createdAt,
      endDate: lastEncounter.createdAt,
      isActive: true,
    },
  });
}

export async function removeEncounterFromEpisode(params: {
  prisma: EncounterEpisodePrisma;
  encounterId: string;
}) {
  const { prisma, encounterId } = params;
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: { id: true, episodeId: true },
  });

  if (!encounter?.episodeId) {
    return;
  }

  await prisma.encounter.update({
    where: { id: encounterId },
    data: { episodeId: null },
  });

  await recomputeEncounterEpisodeWindow(prisma, encounter.episodeId);
}

export async function reconcileEncounterEpisode(params: {
  prisma: EncounterEpisodePrisma;
  encounterId: string;
  patientId: string;
  encounterCreatedAt: Date;
  diagnoses: EncounterEpisodeDiagnosis[];
}) {
  const { prisma, encounterId, patientId, encounterCreatedAt, diagnoses } = params;
  const currentEncounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: {
      id: true,
      status: true,
      episodeId: true,
      episode: {
        select: {
          id: true,
          normalizedLabel: true,
        },
      },
    },
  });

  if (!currentEncounter) {
    return null;
  }

  const primaryDiagnosis = getPrimaryEpisodeDiagnosis(diagnoses);
  if (!primaryDiagnosis || currentEncounter.status === 'CANCELADO') {
    await removeEncounterFromEpisode({ prisma, encounterId });
    return null;
  }

  let targetEpisodeId = currentEncounter.episodeId ?? null;
  const currentEpisodeMatchesDiagnosis =
    currentEncounter.episode?.normalizedLabel === primaryDiagnosis.normalizedLabel;

  if (currentEpisodeMatchesDiagnosis && currentEncounter.episodeId) {
    await prisma.encounterEpisode.update({
      where: { id: currentEncounter.episodeId },
      data: {
        label: primaryDiagnosis.label,
        normalizedLabel: primaryDiagnosis.normalizedLabel,
        isActive: true,
      },
    });
  } else {
    const previousEpisodeId = currentEncounter.episodeId;

    if (previousEpisodeId) {
      await prisma.encounter.update({
        where: { id: encounterId },
        data: { episodeId: null },
      });
      targetEpisodeId = null;
      await recomputeEncounterEpisodeWindow(prisma, previousEpisodeId);
    }

    const existingEpisode = await prisma.encounterEpisode.findFirst({
      where: {
        patientId,
        normalizedLabel: primaryDiagnosis.normalizedLabel,
        isActive: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    if (existingEpisode) {
      targetEpisodeId = existingEpisode.id;
      await prisma.encounterEpisode.update({
        where: { id: existingEpisode.id },
        data: {
          label: primaryDiagnosis.label,
          normalizedLabel: primaryDiagnosis.normalizedLabel,
          isActive: true,
        },
      });
    } else {
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
        select: { id: true },
      });
      targetEpisodeId = createdEpisode.id;
    }

    await prisma.encounter.update({
      where: { id: encounterId },
      data: { episodeId: targetEpisodeId },
    });
  }

  if (targetEpisodeId) {
    await recomputeEncounterEpisodeWindow(prisma, targetEpisodeId);
  }

  return targetEpisodeId;
}