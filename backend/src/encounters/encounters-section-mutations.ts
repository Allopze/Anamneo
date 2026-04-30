import {
  BadRequestException,
  ConflictException,
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
import { RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSectionDto } from './dto/update-section.dto';
import {
  shouldSyncEncounterClinicalStructures,
  syncEncounterClinicalStructures,
} from './encounters-clinical-structures';
import {
  rebuildPatientClinicalSearchProjection,
  shouldSyncPatientClinicalSearch,
} from '../patients/patient-clinical-search-projection';
import { assertEncounterAccess, canEditEncounterCreatedBy } from './encounter-policy';
import {
  IDENTIFICATION_SNAPSHOT_FIELD_META,
  REQUIRED_SEMANTIC_SECTIONS,
  VITAL_SIGNS_ALERT_GENERATION_WARNING,
  buildIdentificationSnapshotFromPatient,
  matchesCurrentPatientSnapshot,
  sanitizeSectionPayload,
  serializeSectionData,
  summarizeSectionAuditData,
} from './encounters-sanitize';
import { isMedicoOnlySection } from './encounter-access-policy';

async function touchEncounterUpdatedAt(prisma: PrismaService, encounterId: string) {
  await prisma.encounter.update({
    where: { id: encounterId },
    data: {
      updatedAt: new Date(),
    },
  });
}

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

  assertEncounterAccess(user, encounter.medicoId, 'No tiene permisos para editar esta atención');

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

  await touchEncounterUpdatedAt(prisma, encounterId);

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

  assertEncounterAccess(user, encounter.medicoId, 'No tiene permisos para editar esta atención');

  if (encounter.status === 'FIRMADO') {
    throw new BadRequestException('No se puede editar una atención firmada. Los registros firmados son inmutables');
  }

  if (encounter.status === 'COMPLETADO') {
    throw new BadRequestException('No se puede editar una atención completada');
  }

  if (encounter.status === 'CANCELADO') {
    throw new BadRequestException('No se puede editar una atención cancelada');
  }

  if (!canEditEncounterCreatedBy(user, encounter.createdById)) {
    throw new ForbiddenException('No tiene permisos para editar esta atención');
  }

  const section = encounter.sections.find((currentSection) => currentSection.sectionKey === sectionKey);
  if (!section) {
    throw new NotFoundException('Sección no encontrada');
  }

  if (user.role !== 'MEDICO' && isMedicoOnlySection(sectionKey)) {
    throw new ForbiddenException('Solo un médico puede editar esta sección clínica');
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

  if (dto.baseUpdatedAt) {
    const baseUpdatedAt = new Date(dto.baseUpdatedAt);
    if (Number.isNaN(baseUpdatedAt.getTime())) {
      throw new BadRequestException('La versión base de la sección no es válida');
    }

    if (section.updatedAt.getTime() !== baseUpdatedAt.getTime()) {
      throw new ConflictException(
        'Esta sección cambió en otra sesión. Recargue la atención y revise antes de sobrescribir.',
      );
    }
  }

  const runTransaction = async <T>(callback: (tx: typeof prisma) => Promise<T>) => {
    if (typeof (prisma as any).$transaction === 'function') {
      return await (prisma as any).$transaction(callback);
    }

    return await callback(prisma as any);
  };

  const updatedSection = await runTransaction(async (tx) => {
    const sectionUpdate = await tx.encounterSection.update({
      where: { id: section.id },
      data: {
        data: serializeSectionData(sanitizedData),
        schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
        completed: dto.completed ?? section.completed,
        notApplicable: dto.notApplicable ?? section.notApplicable,
        notApplicableReason: dto.notApplicable ? (dto.notApplicableReason ?? section.notApplicableReason) : null,
      },
    });

    await tx.encounter.update({
      where: { id: encounterId },
      data: {
        updatedAt: new Date(),
      },
    });

    if (shouldSyncEncounterClinicalStructures(sectionKey)) {
      await syncEncounterClinicalStructures({ prisma: tx, encounterId });
    }

    if (shouldSyncPatientClinicalSearch(sectionKey)) {
      await rebuildPatientClinicalSearchProjection(tx, {
        patientId: encounter.patientId,
        medicoId: encounter.medicoId,
      });
    }

    return sectionUpdate;
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
