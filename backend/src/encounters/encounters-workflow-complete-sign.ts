import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decryptField, encryptNetMeta } from '../common/utils/field-crypto';
import { SectionKey } from '../common/types';
import { assertEncounterClinicalOutputAllowed } from '../common/utils/patient-completeness';
import { assertTreatingMedico } from './encounter-policy';
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
import { syncEncounterClinicalStructures } from './encounters-clinical-structures';
import { withPatientIdentifiers } from '../patients/patients-identifiers';
import {
  getRequiredEncounterSectionKeys,
  type EncounterSectionConfig,
} from '../../../shared/encounter-section-config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
interface CompleteEncounterParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  userId: string;
  closureNote?: string;
  sectionConfig?: EncounterSectionConfig;
}
interface SignEncounterParams {
  prisma: PrismaService;
  auditService: AuditService;
  id: string;
  userId: string;
  password: string;
  context: { ipAddress?: string; userAgent?: string };
}
type SignatureSectionRecord = {
  sectionKey: string;
  data: string;
};
type SignatureAttachmentRecord = {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  uploadedAt: Date;
  uploadedById: string;
  category: string | null;
  description: string | null;
  linkedOrderType: string | null;
  linkedOrderId: string | null;
  linkedOrderLabel: string | null;
};
function buildEncounterSignatureContentPayload(encounter: {
  sections?: SignatureSectionRecord[];
  attachments?: SignatureAttachmentRecord[];
}) {
  const sections = [...(encounter.sections ?? [])]
    .sort((left, right) => left.sectionKey.localeCompare(right.sectionKey))
    .map((section) => {
      const plain = typeof section.data === 'string' && section.data.startsWith('enc:') ? decryptField(section.data) : section.data;
      return { key: section.sectionKey, data: plain };
    });
  const attachments = [...(encounter.attachments ?? [])]
    .sort((left, right) => {
      const uploadedDelta = left.uploadedAt.getTime() - right.uploadedAt.getTime();
      return uploadedDelta !== 0 ? uploadedDelta : left.id.localeCompare(right.id);
    })
    .map((attachment) => ({
      id: attachment.id,
      originalName: attachment.originalName,
      mime: attachment.mime,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt,
      uploadedById: attachment.uploadedById,
      category: attachment.category,
      description: attachment.description,
      linkedOrderType: attachment.linkedOrderType,
      linkedOrderId: attachment.linkedOrderId,
      linkedOrderLabel: attachment.linkedOrderLabel,
    }));
  return {
    sections,
    attachments,
  };
}
export async function completeEncounterWorkflowMutation(params: CompleteEncounterParams) {
  const { prisma, auditService, id, userId, closureNote, sectionConfig } = params;
  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: { sections: true, patient: true },
  });
  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }
  assertTreatingMedico(userId, encounter.medicoId, 'No tiene permisos para completar esta atención');
  if (encounter.status !== 'EN_PROGRESO') {
    throw new BadRequestException('Solo se pueden completar atenciones en progreso');
  }
  assertEncounterClinicalOutputAllowed(withPatientIdentifiers(encounter.patient), 'COMPLETE_ENCOUNTER');
  const sectionByKey = new Map(encounter.sections.map((section) => [section.sectionKey as SectionKey, section]));
  const requiredCompletionSections = sectionConfig
    ? getRequiredEncounterSectionKeys(sectionConfig) as SectionKey[]
    : REQUIRED_COMPLETION_SECTIONS;
  const requiredSemanticSections = sectionConfig
    ? REQUIRED_SEMANTIC_SECTIONS.filter((key) => requiredCompletionSections.includes(key))
    : REQUIRED_SEMANTIC_SECTIONS;
  const incompleteSections = requiredCompletionSections.filter((key) => {
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
  const semanticallyIncompleteSections = requiredSemanticSections.filter((key) => {
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
  const updated = await prisma.$transaction(async (tx) => {
    await syncEncounterClinicalStructures({
      prisma: tx,
      encounterId: id,
    });
    const completedEncounter = await tx.encounter.update({
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
          status: 'COMPLETADO',
          closureNote: summarizeWorkflowNoteAudit(sanitizedClosureNote),
        },
      },
      tx,
    );
    return completedEncounter;
  });
  return formatEncounterResponse(updated);
}
export async function signEncounterWorkflowMutation(params: SignEncounterParams) {
  const { prisma, auditService, id, userId, password, context } = params;
  const encounter = await prisma.encounter.findUnique({
    where: { id },
    include: {
      sections: true,
      attachments: {
        where: { deletedAt: null },
        select: {
          id: true,
          originalName: true,
          mime: true,
          size: true,
          uploadedAt: true,
          uploadedById: true,
          category: true,
          description: true,
          linkedOrderType: true,
          linkedOrderId: true,
          linkedOrderLabel: true,
        },
      },
    },
  });
  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }
  assertTreatingMedico(userId, encounter.medicoId, 'Solo el médico tratante puede firmar esta atención');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    throw new ForbiddenException('Usuario no encontrado o inactivo');
  }
  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new BadRequestException('Contraseña incorrecta. La firma requiere autenticación');
  }
  if (encounter.status !== 'COMPLETADO') {
    throw new BadRequestException('Solo se pueden firmar atenciones completadas');
  }
  const contentPayload = buildEncounterSignatureContentPayload(encounter);
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(contentPayload)).digest('hex');
  const signature = await prisma.$transaction(async (tx) => {
    const createdSignature = await tx.encounterSignature.create({
      data: {
        encounterId: id,
        userId,
        contentHash,
        // Ley 21.719 Art 14 quinquies — cifrar metadatos de red de la firma.
        ipAddress: encryptNetMeta(context.ipAddress ?? null),
        userAgent: encryptNetMeta(context.userAgent ?? null),
      },
    });
    await tx.encounter.update({
      where: { id },
      data: { status: 'FIRMADO' },
    });
    await auditService.log(
      {
        entityType: 'Encounter',
        entityId: id,
        userId,
        action: 'UPDATE',
        diff: {
          status: 'FIRMADO',
          signatureId: createdSignature.id,
          contentHash,
        },
      },
      tx,
    );
    return createdSignature;
  });
  return { signatureId: signature.id, contentHash, signedAt: signature.signedAt };
}
