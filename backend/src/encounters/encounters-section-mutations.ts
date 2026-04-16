import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AlertsService } from '../alerts/alerts.service';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import {
  ENCOUNTER_SECTION_LABELS as SECTION_LABELS,
  getEncounterSectionSchemaVersion,
} from '../common/utils/encounter-section-meta';
import { SectionKey } from '../common/types';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSectionDto } from './dto/update-section.dto';
import {
  IDENTIFICATION_SNAPSHOT_FIELD_META,
  REQUIRED_SEMANTIC_SECTIONS,
  VITAL_SIGNS_ALERT_GENERATION_WARNING,
  buildIdentificationSnapshotFromPatient,
  buildAnamnesisRemotaSnapshotFromHistory,
  matchesCurrentPatientSnapshot,
  sanitizeSectionPayload,
  serializeSectionData,
  summarizeSectionAuditData,
} from './encounters-sanitize';

interface LoggerLike {
  error(message: string, trace?: string): void;
}

interface ReconcileEncounterIdentificationSectionParams {
  prisma: PrismaService;
  auditService: AuditService;
  encounterId: string;
  user: RequestUser;
}

interface UpdateEncounterSectionMutationParams {
  prisma: PrismaService;
  auditService: AuditService;
  alertsService: AlertsService;
  logger: LoggerLike;
  encounterId: string;
  sectionKey: SectionKey;
  dto: UpdateSectionDto;
  user: RequestUser;
}

export async function reconcileEncounterIdentificationSection(params: ReconcileEncounterIdentificationSectionParams) {
  const { prisma, auditService, encounterId, user } = params;

  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: { sections: true, patient: true },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  if (encounter.medicoId !== getEffectiveMedicoId(user)) {
    throw new ForbiddenException('No tiene permisos para editar esta atención');
  }

  if (encounter.status !== 'EN_PROGRESO') {
    throw new BadRequestException('Solo se puede reconciliar la identificación de atenciones en progreso');
  }

  const section = encounter.sections.find((currentSection) => currentSection.sectionKey === 'IDENTIFICACION');
  if (!section) {
    throw new NotFoundException('Sección de identificación no encontrada');
  }

  const snapshotData = buildIdentificationSnapshotFromPatient(encounter.patient);

  const updatedSection = await prisma.encounterSection.update({
    where: { id: section.id },
    data: {
      data: serializeSectionData(snapshotData),
      schemaVersion: getEncounterSectionSchemaVersion('IDENTIFICACION'),
    },
  });

  await auditService.log({
    entityType: 'EncounterSection',
    entityId: section.id,
    userId: user.id,
    action: 'UPDATE',
    reason: 'ENCOUNTER_SECTION_UPDATED',
    diff: { reconciledFields: IDENTIFICATION_SNAPSHOT_FIELD_META.map(({ key }) => key) },
  });

  const formattedSection = formatEncounterSectionForRead(updatedSection);

  return {
    id: updatedSection.id,
    encounterId: updatedSection.encounterId,
    sectionKey: updatedSection.sectionKey,
    completed: updatedSection.completed,
    notApplicable: updatedSection.notApplicable,
    updatedAt: updatedSection.updatedAt,
    data: formattedSection.data ?? {},
    schemaVersion: formattedSection.schemaVersion,
  };
}

export async function updateEncounterSectionMutation(params: UpdateEncounterSectionMutationParams) {
  const { prisma, auditService, alertsService, logger, encounterId, sectionKey, dto, user } = params;

  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: { sections: true, patient: true },
  });

  if (!encounter) {
    throw new NotFoundException('Atención no encontrada');
  }

  const effectiveMedicoId = getEffectiveMedicoId(user);

  if (encounter.medicoId !== effectiveMedicoId) {
    throw new ForbiddenException('No tiene permisos para editar esta atención');
  }

  if (encounter.status === 'FIRMADO') {
    throw new BadRequestException('No se puede editar una atención firmada. Los registros firmados son inmutables');
  }

  if (encounter.status === 'COMPLETADO') {
    throw new BadRequestException('No se puede editar una atención completada');
  }

  if (encounter.status === 'CANCELADO') {
    throw new BadRequestException('No se puede editar una atención cancelada');
  }

  if (encounter.createdById !== user.id && user.role !== 'MEDICO') {
    throw new ForbiddenException('No tiene permisos para editar esta atención');
  }

  const section = encounter.sections.find((currentSection) => currentSection.sectionKey === sectionKey);
  if (!section) {
    throw new NotFoundException('Sección no encontrada');
  }

  const sanitizedData = sanitizeSectionPayload(sectionKey, dto.data);

  if (sectionKey === 'IDENTIFICACION' && !matchesCurrentPatientSnapshot(encounter, sanitizedData)) {
    throw new BadRequestException(
      'La identificación de la atención es un snapshot de solo lectura. Edite la ficha del paciente o restaure desde la ficha maestra.',
    );
  }

  if (dto.notApplicable && (sectionKey === 'IDENTIFICACION' || REQUIRED_SEMANTIC_SECTIONS.includes(sectionKey))) {
    throw new BadRequestException('Esta sección es obligatoria y no se puede marcar como "No aplica"');
  }

  if (dto.notApplicable && !dto.notApplicableReason) {
    throw new BadRequestException('Debe indicar un motivo al marcar la sección como "No aplica"');
  }

  const updatedSection = await prisma.encounterSection.update({
    where: { id: section.id },
    data: {
      data: serializeSectionData(sanitizedData),
      schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
      completed: dto.completed ?? section.completed,
      notApplicable: dto.notApplicable ?? section.notApplicable,
      notApplicableReason: dto.notApplicable ? (dto.notApplicableReason ?? section.notApplicableReason) : null,
    },
  });

  await auditService.log({
    entityType: 'EncounterSection',
    entityId: section.id,
    userId: user.id,
    action: 'UPDATE',
    diff: summarizeSectionAuditData(sectionKey, sanitizedData, dto.completed),
  });

  const vitalSigns =
    sectionKey === 'EXAMEN_FISICO'
      ? (sanitizedData as { signosVitales?: Record<string, string> }).signosVitales
      : undefined;

  let warnings: string[] | undefined;

  if (vitalSigns) {
    try {
      await alertsService.checkVitalSigns(encounter.patientId, encounterId, vitalSigns, user.id);
    } catch (error) {
      logger.error(
        `No se pudieron generar alertas automáticas de signos vitales para la atención ${encounterId}`,
        error instanceof Error ? error.stack : undefined,
      );
      warnings = [VITAL_SIGNS_ALERT_GENERATION_WARNING];
    }
  }

  const formattedSection = formatEncounterSectionForRead(updatedSection);

  return {
    id: updatedSection.id,
    encounterId: updatedSection.encounterId,
    sectionKey: updatedSection.sectionKey,
    sectionLabel: SECTION_LABELS[updatedSection.sectionKey as SectionKey] ?? updatedSection.sectionKey,
    completed: updatedSection.completed,
    notApplicable: updatedSection.notApplicable,
    notApplicableReason: updatedSection.notApplicableReason ?? null,
    updatedAt: updatedSection.updatedAt,
    data: formattedSection.data ?? {},
    schemaVersion: formattedSection.schemaVersion,
    ...(warnings ? { warnings } : {}),
  };
}