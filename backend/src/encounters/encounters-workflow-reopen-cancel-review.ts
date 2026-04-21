import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';
import { assertTreatingMedico, canApplyReviewStatus, assertEncounterAccess } from './encounter-policy';
import { formatEncounterResponse } from './encounters-presenters';
import { removeEncounterFromEpisode } from './encounters-episodes';
import {
  REVIEW_NOTE_MIN_LENGTH,
  sanitizeRequiredWorkflowNote,
  sanitizeText,
  summarizeWorkflowNoteAudit,
} from './encounters-sanitize';
import { type EncounterReopenReasonCode } from '../../../shared/encounter-reopen-reasons';

interface ReopenEncounterParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  userId: string;
  note: string;
  reasonCode: EncounterReopenReasonCode;
}

interface CancelEncounterParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  userId: string;
}

interface UpdateEncounterReviewStatusParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  user: RequestUser;
  reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO';
  note?: string;
}

export async function reopenEncounterWorkflowMutation(params: ReopenEncounterParams) {
  const { prisma, auditService, id, userId, note, reasonCode } = params;

  const encounter = await prisma.encounter.findUnique({
    where: { id },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  if (encounter.status !== 'COMPLETADO') {
    throw new BadRequestException('Solo se pueden reabrir atenciones completadas (las firmadas son inmutables)');
  }

  assertTreatingMedico(userId, encounter.medicoId, 'No tiene permisos para reabrir esta atención');

  const sanitizedNote = sanitizeRequiredWorkflowNote(
    note,
    'La nota de reapertura',
    REVIEW_NOTE_MIN_LENGTH,
    1000,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const reopenedEncounter = await tx.encounter.update({
      where: { id },
      data: {
        status: 'EN_PROGRESO',
        reviewStatus: 'NO_REQUIERE_REVISION',
        reviewRequestedAt: null,
        reviewRequestedById: null,
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
        completedAt: null,
        completedById: null,
        closureNote: null,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
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

    await auditService.log(
      {
        entityType: 'Encounter',
        entityId: id,
        userId,
        action: 'UPDATE',
        diff: {
          status: 'EN_PROGRESO',
          reopenedBy: userId,
          reasonCode,
          note: summarizeWorkflowNoteAudit(sanitizedNote),
        },
      },
      tx,
    );

    return reopenedEncounter;
  });

  return formatEncounterResponse(updated, { viewerRole: 'MEDICO' });
}


export async function cancelEncounterWorkflowMutation(params: CancelEncounterParams) {
  const { prisma, auditService, id, userId } = params;

  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: { patient: true },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  assertTreatingMedico(userId, encounter.medicoId, 'No tiene permisos para cancelar esta atención');

  if (encounter.status !== 'EN_PROGRESO') {
    throw new BadRequestException('Solo se pueden cancelar atenciones en progreso');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelledEncounter = await tx.encounter.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });

    if (encounter.episodeId) {
      await removeEncounterFromEpisode({
        prisma: tx,
        encounterId: id,
      });
    }

    await auditService.log(
      {
        entityType: 'Encounter',
        entityId: id,
        userId,
        action: 'UPDATE',
        diff: { status: 'CANCELADO' },
      },
      tx,
    );

    return cancelledEncounter;
  });

  return updated;
}

export async function updateEncounterReviewStatusMutation(params: UpdateEncounterReviewStatusParams) {
  const { prisma, auditService, id, user, reviewStatus, note } = params;

  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: {
      patient: true,
    },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  assertEncounterAccess(user, encounter.medicoId, 'No tiene permisos para actualizar la revisión de esta atención');

  if (encounter.status === 'CANCELADO') {
    throw new BadRequestException('No se puede revisar una atención cancelada');
  }

  if (encounter.status === 'FIRMADO') {
    throw new BadRequestException('No se puede revisar una atención firmada. Los registros firmados son inmutables');
  }

  if (!canApplyReviewStatus(user, reviewStatus)) {
    if (reviewStatus === 'LISTA_PARA_REVISION') {
      throw new BadRequestException('Solo un asistente puede enviar una atención a revisión médica');
    }

    if (reviewStatus === 'NO_REQUIERE_REVISION') {
      throw new ForbiddenException('Solo un médico puede despejar una revisión pendiente');
    }

    throw new ForbiddenException('Solo un médico puede marcar la atención como revisada');
  }

  const sanitizedNote = reviewStatus === 'REVISADA_POR_MEDICO'
    ? sanitizeRequiredWorkflowNote(note, 'La nota de revisión', REVIEW_NOTE_MIN_LENGTH, 500)
    : sanitizeText(note, 500) ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    const reviewUpdatedEncounter = await tx.encounter.update({
      where: { id },
      data: {
        reviewStatus,
        reviewRequestedAt: reviewStatus === 'LISTA_PARA_REVISION' ? new Date() : null,
        reviewRequestedById: reviewStatus === 'LISTA_PARA_REVISION' ? user.id : null,
        reviewedAt: reviewStatus === 'REVISADA_POR_MEDICO' ? new Date() : null,
        reviewedById: reviewStatus === 'REVISADA_POR_MEDICO' ? user.id : null,
        reviewNote: sanitizedNote,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
        tasks: {
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
          include: { createdBy: { select: { id: true, nombre: true } } },
        },
      },
    });

    await auditService.log(
      {
        entityType: 'Encounter',
        entityId: id,
        userId: user.id,
        action: 'UPDATE',
        diff: {
          reviewStatus,
          note: summarizeWorkflowNoteAudit(sanitizedNote),
        },
      },
      tx,
    );

    return reviewUpdatedEncounter;
  });

  return formatEncounterResponse(updated, { viewerRole: user.role });
}
