import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildAnamnesisRemotaSnapshotFromHistory,
  buildIdentificationSnapshotFromPatient,
  serializeSectionData,
} from '../encounters/encounters-sanitize';
import { buildMergedHistoryUpdate, hasText, type LoadedPatient } from './patients-merge-data.helpers';
type MergeCounts = {
  encountersMoved: number;
  inProgressEncountersRebased: number;
  episodesMoved: number;
  episodeLinksReused: number;
  problemsMoved: number;
  tasksMoved: number;
  consentsMoved: number;
  alertsMoved: number;
};
export {
  buildMergedHistoryUpdate,
  buildTargetPatientMergeData,
  hasText,
  mergeHistoryFieldValues,
  parseStoredHistoryValue,
  preferTargetValue,
  type LoadedPatient,
} from './patients-merge-data.helpers';
interface ExecutePatientMergeTransactionParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  targetPatientId: string;
  sourcePatientId: string;
  updateData: Prisma.PatientUpdateInput;
  shouldTransferRut: boolean;
  targetPatient: LoadedPatient;
  sourcePatient: LoadedPatient;
}
export async function executePatientMergeTransaction(params: ExecutePatientMergeTransactionParams) {
  const {
    prisma,
    auditService,
    user,
    targetPatientId,
    sourcePatientId,
    updateData,
    shouldTransferRut,
    targetPatient,
    sourcePatient,
  } = params;
  const counts: MergeCounts = {
    encountersMoved: 0,
    inProgressEncountersRebased: 0,
    episodesMoved: 0,
    episodeLinksReused: 0,
    problemsMoved: 0,
    tasksMoved: 0,
    consentsMoved: 0,
    alertsMoved: 0,
  };
  const mergedPatient = await prisma.$transaction(async (tx) => {
    const [
      sourceEncounters,
      sourceEpisodes,
      targetEpisodes,
      sourceProblemsCount,
      sourceTasksCount,
      sourceConsentsCount,
      sourceAlertsCount,
    ] = await Promise.all([
      tx.encounter.findMany({
        where: { patientId: sourcePatientId },
        select: { id: true, status: true },
      }),
      tx.encounterEpisode.findMany({
        where: { patientId: sourcePatientId },
        select: {
          id: true,
          normalizedLabel: true,
          startDate: true,
          endDate: true,
          isActive: true,
          firstEncounterId: true,
          lastEncounterId: true,
        },
      }),
      tx.encounterEpisode.findMany({
        where: { patientId: targetPatientId },
        select: {
          id: true,
          normalizedLabel: true,
          startDate: true,
          endDate: true,
          isActive: true,
          firstEncounterId: true,
          lastEncounterId: true,
        },
      }),
      tx.patientProblem.count({ where: { patientId: sourcePatientId } }),
      tx.encounterTask.count({ where: { patientId: sourcePatientId } }),
      tx.clinicalConsent.count({ where: { patientId: sourcePatientId } }),
      tx.clinicalAlert.count({ where: { patientId: sourcePatientId } }),
    ]);
    counts.encountersMoved = sourceEncounters.length;
    counts.problemsMoved = sourceProblemsCount;
    counts.tasksMoved = sourceTasksCount;
    counts.consentsMoved = sourceConsentsCount;
    counts.alertsMoved = sourceAlertsCount;
    counts.inProgressEncountersRebased = sourceEncounters.filter((encounter) => encounter.status === 'EN_PROGRESO').length;
    const targetEpisodeByNormalizedLabel = new Map(
      targetEpisodes
        .filter((episode) => hasText(episode.normalizedLabel))
        .map((episode) => [episode.normalizedLabel, episode] as const),
    );
    for (const sourceEpisode of sourceEpisodes) {
      const matchingTargetEpisode = hasText(sourceEpisode.normalizedLabel)
        ? targetEpisodeByNormalizedLabel.get(sourceEpisode.normalizedLabel)
        : undefined;
      if (!matchingTargetEpisode) {
        await tx.encounterEpisode.update({
          where: { id: sourceEpisode.id },
          data: { patientId: targetPatientId },
        });
        counts.episodesMoved += 1;
        continue;
      }
      await tx.encounter.updateMany({
        where: { episodeId: sourceEpisode.id },
        data: { episodeId: matchingTargetEpisode.id },
      });
      await tx.encounterEpisode.update({
        where: { id: matchingTargetEpisode.id },
        data: {
          startDate:
            matchingTargetEpisode.startDate && sourceEpisode.startDate
              ? new Date(Math.min(matchingTargetEpisode.startDate.getTime(), sourceEpisode.startDate.getTime()))
              : (matchingTargetEpisode.startDate ?? sourceEpisode.startDate ?? null),
          endDate:
            matchingTargetEpisode.endDate && sourceEpisode.endDate
              ? new Date(Math.max(matchingTargetEpisode.endDate.getTime(), sourceEpisode.endDate.getTime()))
              : (matchingTargetEpisode.endDate ?? sourceEpisode.endDate ?? null),
          isActive: matchingTargetEpisode.isActive || sourceEpisode.isActive,
          firstEncounterId: matchingTargetEpisode.firstEncounterId ?? sourceEpisode.firstEncounterId ?? null,
          lastEncounterId: sourceEpisode.lastEncounterId ?? matchingTargetEpisode.lastEncounterId ?? null,
        },
      });
      await tx.encounterEpisode.delete({ where: { id: sourceEpisode.id } });
      counts.episodeLinksReused += 1;
    }
    await Promise.all([
      tx.encounter.updateMany({
        where: { patientId: sourcePatientId },
        data: { patientId: targetPatientId },
      }),
      tx.patientProblem.updateMany({
        where: { patientId: sourcePatientId },
        data: { patientId: targetPatientId },
      }),
      tx.encounterTask.updateMany({
        where: { patientId: sourcePatientId },
        data: { patientId: targetPatientId },
      }),
      tx.clinicalConsent.updateMany({
        where: { patientId: sourcePatientId },
        data: { patientId: targetPatientId },
      }),
      tx.clinicalAlert.updateMany({
        where: { patientId: sourcePatientId },
        data: { patientId: targetPatientId },
      }),
    ]);
    const mergedHistoryData = buildMergedHistoryUpdate(targetPatient.history, sourcePatient.history);
    await tx.patientHistory.upsert({
      where: { patientId: targetPatientId },
      update: mergedHistoryData,
      create: {
        patientId: targetPatientId,
        ...mergedHistoryData,
      },
    });
    if (shouldTransferRut) {
      await tx.patient.update({
        where: { id: sourcePatientId },
        data: { rutEnc: null, rutLookupHash: null },
      });
    }
    const updatedTargetPatient = await tx.patient.update({
      where: { id: targetPatientId },
      data: updateData,
      include: { history: true },
    });
    const sourceInProgressEncounterIds = sourceEncounters
      .filter((encounter) => encounter.status === 'EN_PROGRESO')
      .map((encounter) => encounter.id);
    if (sourceInProgressEncounterIds.length > 0) {
      const identificationSnapshot = serializeSectionData(buildIdentificationSnapshotFromPatient(updatedTargetPatient));
      const anamnesisRemotaSnapshot = serializeSectionData(
        buildAnamnesisRemotaSnapshotFromHistory(updatedTargetPatient.history),
      );
      await Promise.all([
        tx.encounterSection.updateMany({
          where: {
            encounterId: { in: sourceInProgressEncounterIds },
            sectionKey: 'IDENTIFICACION',
          },
          data: { data: identificationSnapshot },
        }),
        tx.encounterSection.updateMany({
          where: {
            encounterId: { in: sourceInProgressEncounterIds },
            sectionKey: 'ANAMNESIS_REMOTA',
          },
          data: { data: anamnesisRemotaSnapshot },
        }),
      ]);
    }
    await tx.patient.update({
      where: { id: sourcePatientId },
      data: {
        archivedAt: new Date(),
        archivedById: user.id,
      },
    });
    await auditService.log(
      {
        entityType: 'Patient',
        entityId: targetPatientId,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          scope: 'MERGE_TARGET',
          mergedFromPatientId: sourcePatientId,
          before: targetPatient,
          after: updatedTargetPatient,
          counts,
        },
      },
      tx,
    );
    await auditService.log(
      {
        entityType: 'Patient',
        entityId: sourcePatientId,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          scope: 'MERGE_SOURCE_ARCHIVED',
          mergedIntoPatientId: targetPatientId,
          archivedAt: new Date().toISOString(),
          archivedById: user.id,
          counts,
        },
      },
      tx,
    );
    await auditService.log(
      {
        entityType: 'PatientMerge',
        entityId: targetPatientId,
        userId: user.id,
        action: 'UPDATE',
        reason: 'PATIENT_UPDATED',
        diff: {
          targetPatientId,
          sourcePatientId,
          counts,
        },
      },
      tx,
    );
    return updatedTargetPatient;
  });
  return {
    patient: mergedPatient,
    counts,
  };
}
