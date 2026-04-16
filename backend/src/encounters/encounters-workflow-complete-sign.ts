import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decryptField } from '../common/utils/field-crypto';
import { SectionKey } from '../common/types';
import { assertEncounterClinicalOutputAllowed } from '../common/utils/patient-completeness';
import { formatEncounterResponse } from './encounters-presenters';
import {
  REQUIRED_COMPLETION_SECTIONS,
  REQUIRED_SEMANTIC_SECTIONS,
  REVIEW_NOTE_MIN_LENGTH,
  hasMeaningfulContent,
  parseSectionData,
  sanitizeRequiredWorkflowNote,
  summarizeWorkflowNoteAudit,
} from './encounters-sanitize';
import { ENCOUNTER_SECTION_LABELS as SECTION_LABELS } from '../common/utils/encounter-section-meta';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

interface CompleteEncounterParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  userId: string;
  closureNote?: string;
}

interface SignEncounterParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  userId: string;
  password: string;
  context: { ipAddress?: string; userAgent?: string };
}

export async function completeEncounterWorkflowMutation(params: CompleteEncounterParams) {
  const { prisma, auditService, id, userId, closureNote } = params;

  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: { sections: true, patient: true },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  if (encounter.status !== 'EN_PROGRESO') {
    throw new BadRequestException('Solo se pueden completar atenciones en progreso');
  }

  if (encounter.medicoId !== userId) {
    throw new ForbiddenException('No tiene permisos para completar esta atención');
  }

  assertEncounterClinicalOutputAllowed(encounter.patient, 'COMPLETE_ENCOUNTER');

  const sectionByKey = new Map(encounter.sections.map((section) => [section.sectionKey as SectionKey, section]));

  const incompleteSections = REQUIRED_COMPLETION_SECTIONS.filter((key) => {
    const section = sectionByKey.get(key);
    return !section || !section.completed;
  });

  if (incompleteSections.length > 0) {
    throw new BadRequestException(
      `Las siguientes secciones obligatorias no están completas: ${incompleteSections
        .map((key) => SECTION_LABELS[key])
        .join(', ')}`,
    );
  }

  const semanticallyIncompleteSections = REQUIRED_SEMANTIC_SECTIONS.filter((key) => {
    const section = sectionByKey.get(key);
    if (!section) {
      return true;
    }

    return !hasMeaningfulContent(parseSectionData(section.data));
  });

  if (semanticallyIncompleteSections.length > 0) {
    throw new BadRequestException(
      `Las siguientes secciones obligatorias no tienen contenido clínico suficiente: ${semanticallyIncompleteSections
        .map((key) => SECTION_LABELS[key])
        .join(', ')}`,
    );
  }

  const sanitizedClosureNote = sanitizeRequiredWorkflowNote(closureNote, 'La nota de cierre', REVIEW_NOTE_MIN_LENGTH, 1000);

  const updated = await prisma.encounter.update({
    where: { id },
    data: {
      status: 'COMPLETADO',
      reviewStatus: 'REVISADA_POR_MEDICO',
      reviewedAt: new Date(),
      reviewedById: userId,
      completedAt: new Date(),
      completedById: userId,
      closureNote: sanitizedClosureNote,
    },
    include: {
      sections: true,
      patient: true,
      createdBy: { select: { id: true, nombre: true } },
      reviewRequestedBy: { select: { id: true, nombre: true } },
      reviewedBy: { select: { id: true, nombre: true } },
      completedBy: { select: { id: true, nombre: true } },
    },
  });

  await auditService.log({
    entityType: 'Encounter',
    entityId: id,
    userId,
    action: 'UPDATE',
    diff: {
      status: 'COMPLETADO',
      closureNote: summarizeWorkflowNoteAudit(sanitizedClosureNote),
    },
  });

  return formatEncounterResponse(updated);
}

export async function signEncounterWorkflowMutation(params: SignEncounterParams) {
  const { prisma, auditService, id, userId, password, context } = params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    throw new ForbiddenException('Usuario no encontrado o inactivo');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new BadRequestException('Contraseña incorrecta. La firma requiere autenticación');
  }

  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: { sections: true },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  if (encounter.medicoId !== userId) {
    throw new ForbiddenException('Solo el médico tratante puede firmar esta atención');
  }

  if (encounter.status !== 'COMPLETADO') {
    throw new BadRequestException('Solo se pueden firmar atenciones completadas');
  }

  const contentPayload = encounter.sections
    .sort((a, b) => a.sectionKey.localeCompare(b.sectionKey))
    .map((section) => {
      const plain = typeof section.data === 'string' && section.data.startsWith('enc:') ? decryptField(section.data) : section.data;
      return { key: section.sectionKey, data: plain };
    });
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(contentPayload)).digest('hex');

  const [signature] = await prisma.$transaction([
    prisma.encounterSignature.create({
      data: {
        encounterId: id,
        userId,
        contentHash,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    }),
    prisma.encounter.update({
      where: { id },
      data: { status: 'FIRMADO' },
    }),
  ]);

  await auditService.log({
    entityType: 'Encounter',
    entityId: id,
    userId,
    action: 'UPDATE',
    diff: {
      status: 'FIRMADO',
      signatureId: signature.id,
      contentHash,
    },
  });

  return { signatureId: signature.id, contentHash, signedAt: signature.signedAt };
}
