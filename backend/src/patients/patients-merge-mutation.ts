import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PatientHistory, Prisma } from '@prisma/client';
import { parseStoredJson } from '../common/utils/encounter-sections';
import {
  PATIENT_HISTORY_FIELD_KEYS,
  type PatientHistoryFieldKey,
  type PatientHistoryFieldValue,
  sanitizePatientHistoryFieldValue,
} from '../common/utils/patient-history';
import type { RequestUser } from '../common/utils/medico-id';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeNullableEmail,
  normalizeNullableString,
  resolvePatientVerificationState,
} from './patients-format';
import {
  buildAnamnesisRemotaSnapshotFromHistory,
  buildIdentificationSnapshotFromPatient,
  serializeSectionData,
} from '../encounters/encounters-sanitize';

type AssertPatientAccessFn = (user: RequestUser, patientId: string) => Promise<unknown>;

interface MergePatientIntoTargetParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  targetPatientId: string;
  sourcePatientId: string;
  assertPatientAccess: AssertPatientAccessFn;
}

type LoadedPatient = Awaited<ReturnType<PrismaService['patient']['findUnique']>>;

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

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function preferTargetValue(target: string | null | undefined, source: string | null | undefined) {
  return hasText(target) ? target : source;
}

function parseStoredHistoryValue(history: PatientHistory | null | undefined, key: PatientHistoryFieldKey) {
  const rawValue = history?.[key];
  if (!rawValue) {
    return null;
  }

  const parsed = parseStoredJson<PatientHistoryFieldValue | null>(rawValue, null);
  return sanitizePatientHistoryFieldValue(key, parsed, { rejectUnknownKeys: true }) ?? null;
}

function mergeHistoryFieldValues(
  key: PatientHistoryFieldKey,
  targetValue: PatientHistoryFieldValue | null,
  sourceValue: PatientHistoryFieldValue | null,
) {
  const mergedItems = [...new Set([...(targetValue?.items ?? []), ...(sourceValue?.items ?? [])])];
  const targetText = targetValue?.texto?.trim();
  const sourceText = sourceValue?.texto?.trim();

  let mergedText: string | undefined;
  if (targetText && sourceText && targetText !== sourceText) {
    mergedText = targetText.includes(sourceText) ? targetText : `${targetText}\n\n${sourceText}`;
  } else {
    mergedText = targetText || sourceText || undefined;
  }

  const merged = sanitizePatientHistoryFieldValue(
    key,
    {
      ...(mergedText ? { texto: mergedText } : {}),
      ...(mergedItems.length > 0 ? { items: mergedItems } : {}),
    },
    { rejectUnknownKeys: true },
  );

  return merged ? JSON.stringify(merged) : null;
}

function buildMergedHistoryUpdate(targetHistory: PatientHistory | null | undefined, sourceHistory: PatientHistory | null | undefined) {
  const updateData: Record<string, string | null> = {};

  for (const key of PATIENT_HISTORY_FIELD_KEYS) {
    const targetRawValue = targetHistory?.[key];
    const sourceRawValue = sourceHistory?.[key];
    const targetParsedValue = parseStoredHistoryValue(targetHistory, key);
    const sourceParsedValue = parseStoredHistoryValue(sourceHistory, key);

    if (!sourceParsedValue && typeof targetRawValue === 'string') {
      updateData[key] = targetRawValue;
      continue;
    }

    if (!targetParsedValue && typeof sourceRawValue === 'string') {
      updateData[key] = sourceRawValue;
      continue;
    }

    updateData[key] = mergeHistoryFieldValues(
      key,
      targetParsedValue,
      sourceParsedValue,
    );
  }

  return updateData;
}

function buildTargetPatientMergeData(params: {
  targetPatient: NonNullable<LoadedPatient>;
  sourcePatient: NonNullable<LoadedPatient>;
  user: RequestUser;
}) {
  const { targetPatient, sourcePatient, user } = params;

  const targetHasRut = hasText(targetPatient.rut);
  const sourceHasRut = hasText(sourcePatient.rut);
  const shouldTransferRut = !targetHasRut && sourceHasRut;
  const shouldCopyRutExemption =
    !targetHasRut &&
    !targetPatient.rutExempt &&
    sourcePatient.rutExempt &&
    hasText(sourcePatient.rutExemptReason);

  const updateData: Prisma.PatientUpdateInput = {
    rut: shouldTransferRut ? sourcePatient.rut : targetPatient.rut,
    rutExempt: shouldTransferRut ? false : (targetPatient.rutExempt || shouldCopyRutExemption),
    rutExemptReason: shouldTransferRut
      ? null
      : (targetPatient.rutExemptReason ?? (shouldCopyRutExemption ? sourcePatient.rutExemptReason : null)),
    fechaNacimiento: targetPatient.fechaNacimiento ?? sourcePatient.fechaNacimiento ?? null,
    edad: targetPatient.edad ?? sourcePatient.edad ?? null,
    edadMeses: targetPatient.edadMeses ?? sourcePatient.edadMeses ?? null,
    sexo: targetPatient.sexo ?? sourcePatient.sexo ?? null,
    prevision: targetPatient.prevision ?? sourcePatient.prevision ?? null,
    trabajo: normalizeNullableString(preferTargetValue(targetPatient.trabajo, sourcePatient.trabajo)),
    domicilio: normalizeNullableString(preferTargetValue(targetPatient.domicilio, sourcePatient.domicilio)),
    telefono: normalizeNullableString(preferTargetValue(targetPatient.telefono, sourcePatient.telefono)),
    email: normalizeNullableEmail(preferTargetValue(targetPatient.email, sourcePatient.email)),
    contactoEmergenciaNombre: normalizeNullableString(
      preferTargetValue(targetPatient.contactoEmergenciaNombre, sourcePatient.contactoEmergenciaNombre),
    ),
    contactoEmergenciaTelefono: normalizeNullableString(
      preferTargetValue(targetPatient.contactoEmergenciaTelefono, sourcePatient.contactoEmergenciaTelefono),
    ),
    centroMedico: normalizeNullableString(preferTargetValue(targetPatient.centroMedico, sourcePatient.centroMedico)),
    registrationMode:
      targetPatient.registrationMode === 'COMPLETO' || sourcePatient.registrationMode === 'COMPLETO'
        ? 'COMPLETO'
        : 'RAPIDO',
  };

  const nextPatient = {
    ...targetPatient,
    ...updateData,
  };

  Object.assign(
    updateData,
    resolvePatientVerificationState({
      currentPatient: targetPatient,
      nextPatient,
      actorId: user.id,
      actorRole: user.role,
      mode: 'UPDATE_FULL',
    }),
  );

  return {
    updateData,
    shouldTransferRut,
  };
}

export async function mergePatientIntoTarget(params: MergePatientIntoTargetParams) {
  const {
    prisma,
    auditService,
    user,
    targetPatientId,
    sourcePatientId,
    assertPatientAccess,
  } = params;

  if (targetPatientId === sourcePatientId) {
    throw new BadRequestException('Debe seleccionar una ficha distinta para fusionar');
  }

  await Promise.all([
    assertPatientAccess(user, targetPatientId),
    assertPatientAccess(user, sourcePatientId),
  ]);

  const [targetPatient, sourcePatient] = await Promise.all([
    prisma.patient.findUnique({ where: { id: targetPatientId }, include: { history: true } }),
    prisma.patient.findUnique({ where: { id: sourcePatientId }, include: { history: true } }),
  ]);

  if (!targetPatient || targetPatient.archivedAt) {
    throw new NotFoundException('Paciente destino no encontrado');
  }

  if (!sourcePatient || sourcePatient.archivedAt) {
    throw new NotFoundException('Paciente origen no encontrado');
  }

  const { updateData, shouldTransferRut } = buildTargetPatientMergeData({
    targetPatient,
    sourcePatient,
    user,
  });

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
      tx.informedConsent.count({ where: { patientId: sourcePatientId } }),
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
      tx.informedConsent.updateMany({
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
        data: {
          rut: null,
        },
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
          data: {
            data: identificationSnapshot,
          },
        }),
        tx.encounterSection.updateMany({
          where: {
            encounterId: { in: sourceInProgressEncounterIds },
            sectionKey: 'ANAMNESIS_REMOTA',
          },
          data: {
            data: anamnesisRemotaSnapshot,
          },
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
