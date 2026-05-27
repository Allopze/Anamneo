import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { decryptNetMeta } from '../common/utils/field-crypto';
import { isDateOnlyBeforeToday } from '../common/utils/local-date';
import {
  ENCOUNTER_SECTION_LABELS as SECTION_LABELS,
  ENCOUNTER_SECTION_ORDER as SECTION_ORDER,
} from '../common/utils/encounter-section-meta';
import type { EncounterSectionConfig } from '../../../shared/encounter-section-config';
import { getEnabledEncounterSectionKeys } from '../../../shared/encounter-section-config';
import {
  getEncounterClinicalOutputBlock,
  getPatientDemographicsMissingFields,
} from '../common/utils/patient-completeness';
import {
  buildIdentificationSnapshotStatus,
  formatTask,
  parseSectionData,
} from './encounters-sanitize';
import { shouldHideEncounterSectionForRole } from './encounter-access-policy';
import { resolvePatientIdentifiers, withPatientIdentifiers } from '../patients/patients-identifiers';

interface FormatEncounterResponseOptions {
  viewerRole?: string;
  sectionConfig?: EncounterSectionConfig;
}

function formatProgress(
  sections: Array<{ completed: boolean; sectionKey?: string }>,
  sectionConfig?: EncounterSectionConfig,
) {
  const enabledKeys = sectionConfig ? new Set(getEnabledEncounterSectionKeys(sectionConfig)) : null;
  const visibleSections = enabledKeys
    ? sections.filter((section) => section.sectionKey && enabledKeys.has(section.sectionKey as any))
    : sections;
  return {
    completed: visibleSections.filter((section) => section.completed).length,
    total: visibleSections.length,
  };
}

function formatEpisodeSummary(episode: any) {
  if (!episode) {
    return null;
  }

  return {
    id: episode.id,
    label: episode.label,
    normalizedLabel: episode.normalizedLabel,
    startDate: episode.startDate ?? null,
    endDate: episode.endDate ?? null,
    isActive: episode.isActive,
  };
}

export function formatEncounterForList(encounter: any, options: FormatEncounterResponseOptions = {}) {
  const patientIdentifiers = encounter.patient ? resolvePatientIdentifiers(encounter.patient) : null;
  const patientForCompleteness = encounter.patient ? { ...encounter.patient, ...patientIdentifiers } : null;

  return {
    id: encounter.id,
    patientId: encounter.patientId,
    status: encounter.status,
    reviewStatus: encounter.reviewStatus,
    reviewRequestedAt: encounter.reviewRequestedAt,
    reviewNote: encounter.reviewNote,
    reviewedAt: encounter.reviewedAt,
    completedAt: encounter.completedAt,
    closureNote: encounter.closureNote,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    createdById: encounter.createdById,
    patient: encounter.patient
      ? {
          id: encounter.patient.id,
          rut: patientIdentifiers?.rut ?? null,
          nombre: patientIdentifiers?.nombre ?? '',
          fechaNacimiento: encounter.patient.fechaNacimiento,
          edad: encounter.patient.edad,
          sexo: encounter.patient.sexo,
          prevision: encounter.patient.prevision,
          registrationMode: encounter.patient.registrationMode,
          completenessStatus: encounter.patient.completenessStatus,
          demographicsMissingFields: getPatientDemographicsMissingFields(patientForCompleteness!),
        }
      : undefined,
    createdBy: encounter.createdBy,
    reviewRequestedBy: encounter.reviewRequestedBy,
    reviewedBy: encounter.reviewedBy,
    completedBy: encounter.completedBy,
    episode: formatEpisodeSummary(encounter.episode),
    progress: formatProgress(encounter.sections, options.sectionConfig),
  };
}

export function formatEncounterForPatientList(encounter: any, options: FormatEncounterResponseOptions = {}) {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    status: encounter.status,
    reviewStatus: encounter.reviewStatus,
    reviewRequestedAt: encounter.reviewRequestedAt,
    reviewNote: encounter.reviewNote,
    reviewedAt: encounter.reviewedAt,
    completedAt: encounter.completedAt,
    closureNote: encounter.closureNote,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    createdById: encounter.createdById,
    createdBy: encounter.createdBy,
    reviewRequestedBy: encounter.reviewRequestedBy,
    reviewedBy: encounter.reviewedBy,
    completedBy: encounter.completedBy,
    episode: formatEpisodeSummary(encounter.episode),
    progress: formatProgress(encounter.sections, options.sectionConfig),
  };
}

export function formatDashboardRecentEncounter(encounter: any) {
  const patientIdentifiers = resolvePatientIdentifiers(encounter.patient);
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    patientName: patientIdentifiers.nombre,
    patientRut: patientIdentifiers.rut,
    createdByName: encounter.createdBy.nombre,
    status: encounter.status,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    episode: formatEpisodeSummary(encounter.episode),
    progress: formatProgress(encounter.sections),
  };
}

export function formatDashboardUpcomingTask(task: any) {
  const patientIdentifiers = task.patient ? resolvePatientIdentifiers(task.patient) : null;
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    isOverdue: Boolean(task.dueDate && isDateOnlyBeforeToday(task.dueDate)),
    patient: task.patient ? { id: task.patient.id, ...patientIdentifiers } : task.patient,
    createdBy: task.createdBy,
  };
}

export function formatEncounterResponse(encounter: any, options: FormatEncounterResponseOptions = {}) {
  const { viewerRole, sectionConfig } = options;
  const configuredSections = new Map((sectionConfig?.sections ?? []).map((section) => [section.key, section]));
  const sortedSections = [...(encounter.sections || [])].sort((a: any, b: any) => {
    const leftOrder = configuredSections.get(a.sectionKey)?.order ?? SECTION_ORDER.indexOf(a.sectionKey);
    const rightOrder = configuredSections.get(b.sectionKey)?.order ?? SECTION_ORDER.indexOf(b.sectionKey);
    return leftOrder - rightOrder;
  });
  const visibleSections = sortedSections.filter(
    (section: any) => {
      const configured = configuredSections.get(section.sectionKey);
      return configured?.enabled !== false
        && !shouldHideEncounterSectionForRole(viewerRole, section.sectionKey as SectionKey);
    },
  );

  const patientWithIdentifiers = encounter.patient ? withPatientIdentifiers(encounter.patient) : null;
  const clinicalOutputBlock = getEncounterClinicalOutputBlock(patientWithIdentifiers);

  return {
    id: encounter.id,
    patientId: encounter.patientId,
    status: encounter.status,
    reviewStatus: encounter.reviewStatus,
    reviewRequestedAt: encounter.reviewRequestedAt ?? null,
    reviewNote: encounter.reviewNote ?? null,
    reviewedAt: encounter.reviewedAt ?? null,
    completedAt: encounter.completedAt ?? null,
    closureNote: encounter.closureNote ?? null,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    episode: formatEpisodeSummary(encounter.episode),
    createdById: encounter.createdById,
    clinicalOutputBlock,
    identificationSnapshotStatus: buildIdentificationSnapshotStatus(encounter),
    createdBy: encounter.createdBy ? { id: encounter.createdBy.id, nombre: encounter.createdBy.nombre } : undefined,
    medico: encounter.medico ? { id: encounter.medico.id, nombre: encounter.medico.nombre } : undefined,
    reviewRequestedBy: encounter.reviewRequestedBy
      ? { id: encounter.reviewRequestedBy.id, nombre: encounter.reviewRequestedBy.nombre }
      : undefined,
    reviewedBy: encounter.reviewedBy
      ? { id: encounter.reviewedBy.id, nombre: encounter.reviewedBy.nombre }
      : undefined,
    completedBy: encounter.completedBy
      ? { id: encounter.completedBy.id, nombre: encounter.completedBy.nombre }
      : undefined,
    signatures: (encounter.signatures || []).map((signature: any) => ({
      id: signature.id,
      encounterId: signature.encounterId,
      userId: signature.userId,
      signatureType: signature.signatureType,
      contentHash: signature.contentHash,
      // Ley 21.719 Art 14 quinquies — descifrar para exponer al UI admin.
      ipAddress: decryptNetMeta(signature.ipAddress),
      userAgent: decryptNetMeta(signature.userAgent),
      signedAt: signature.signedAt,
      revokedAt: signature.revokedAt ?? null,
      revokedReason: signature.revokedReason ?? null,
    })),
    attachments: (encounter.attachments || []).map((attachment: any) => ({
      id: attachment.id,
      originalName: attachment.originalName,
      mime: attachment.mime,
      size: attachment.size,
      category: attachment.category ?? null,
      description: attachment.description ?? null,
      linkedOrderType: attachment.linkedOrderType ?? null,
      linkedOrderId: attachment.linkedOrderId ?? null,
      linkedOrderLabel: attachment.linkedOrderLabel ?? null,
      uploadedAt: attachment.uploadedAt,
    })),
    consents: (encounter.consents || []).map((consent: any) => ({
      id: consent.id,
      patientId: consent.patientId,
      encounterId: consent.encounterId ?? null,
      type: consent.type,
      description: consent.description,
      status: consent.revokedAt ? 'REVOCADO' : 'ACTIVO',
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt ?? null,
      revokeReason: consent.revokedReason ?? null,
      createdAt: consent.createdAt,
      updatedAt: consent.updatedAt,
      grantedBy: null,
    })),
    signatureBaseline: encounter.signatureBaseline
      ? {
          id: encounter.signatureBaseline.id,
          status: encounter.signatureBaseline.status,
          createdAt: encounter.signatureBaseline.createdAt,
          closureNote: encounter.signatureBaseline.closureNote ?? null,
          attachments: (encounter.signatureBaseline.attachments || []).map((attachment: any) => ({
            id: attachment.id,
            originalName: attachment.originalName,
            mime: attachment.mime,
            size: attachment.size,
            category: attachment.category ?? null,
            description: attachment.description ?? null,
            linkedOrderType: attachment.linkedOrderType ?? null,
            linkedOrderId: attachment.linkedOrderId ?? null,
            linkedOrderLabel: attachment.linkedOrderLabel ?? null,
            uploadedAt: attachment.uploadedAt,
          })),
          sections: (encounter.signatureBaseline.sections || []).map((section: any) => ({
            ...formatEncounterSectionForRead({
              ...section,
              data: parseSectionData(section.data) ?? {},
            }),
            label: configuredSections.get(section.sectionKey)?.label ?? SECTION_LABELS[section.sectionKey as SectionKey],
            order: configuredSections.get(section.sectionKey)?.order ?? SECTION_ORDER.indexOf(section.sectionKey as SectionKey),
            requiredForCompletion: configuredSections.get(section.sectionKey)?.requiredForCompletion ?? false,
          })),
        }
      : null,
    patient: encounter.patient
      ? {
          id: encounter.patient.id,
          rut: patientWithIdentifiers?.rut ?? null,
          rutExempt: encounter.patient.rutExempt,
          rutExemptReason: encounter.patient.rutExemptReason,
          nombre: patientWithIdentifiers?.nombre ?? '',
          fechaNacimiento: encounter.patient.fechaNacimiento,
          edad: encounter.patient.edad,
          edadMeses: encounter.patient.edadMeses,
          sexo: encounter.patient.sexo,
          trabajo: encounter.patient.trabajo,
          prevision: encounter.patient.prevision,
          registrationMode: encounter.patient.registrationMode,
          completenessStatus: encounter.patient.completenessStatus,
          demographicsVerifiedAt: encounter.patient.demographicsVerifiedAt ?? null,
          domicilio: patientWithIdentifiers?.domicilio ?? null,
          centroMedico: encounter.patient.centroMedico,
          createdAt: encounter.patient.createdAt,
          updatedAt: encounter.patient.updatedAt,
          demographicsMissingFields: getPatientDemographicsMissingFields(patientWithIdentifiers),
          history: encounter.patient.history,
          problems: (encounter.patient.problems || []).map((problem: any) => ({
            id: problem.id,
            patientId: problem.patientId,
            encounterId: problem.encounterId ?? null,
            label: problem.label,
            status: problem.status,
            notes: problem.notes ?? null,
            severity: problem.severity ?? null,
            onsetDate: problem.onsetDate ?? null,
            resolvedAt: problem.resolvedAt ?? null,
            createdAt: problem.createdAt,
            updatedAt: problem.updatedAt,
          })),
          tasks: (encounter.patient.tasks || []).map((task: any) => formatTask(task)),
        }
      : encounter.patient,
    tasks: (encounter.tasks || []).map((task: any) => formatTask(task)),
    sections: visibleSections.map((section: any) => ({
      ...formatEncounterSectionForRead({
        ...section,
        data: parseSectionData(section.data) ?? {},
      }),
      label: configuredSections.get(section.sectionKey)?.label ?? SECTION_LABELS[section.sectionKey as SectionKey],
      order: configuredSections.get(section.sectionKey)?.order ?? SECTION_ORDER.indexOf(section.sectionKey as SectionKey),
      requiredForCompletion: configuredSections.get(section.sectionKey)?.requiredForCompletion ?? false,
    })),
  };
}
