import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { isDateOnlyBeforeToday } from '../common/utils/local-date';
import {
  ENCOUNTER_SECTION_LABELS as SECTION_LABELS,
  ENCOUNTER_SECTION_ORDER as SECTION_ORDER,
} from '../common/utils/encounter-section-meta';
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

interface FormatEncounterResponseOptions {
  viewerRole?: string;
}

function formatProgress(sections: Array<{ completed: boolean }>) {
  return {
    completed: sections.filter((section) => section.completed).length,
    total: sections.length,
  };
}

export function formatEncounterForList(encounter: any) {
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
          rut: encounter.patient.rut,
          nombre: encounter.patient.nombre,
          fechaNacimiento: encounter.patient.fechaNacimiento,
          edad: encounter.patient.edad,
          sexo: encounter.patient.sexo,
          prevision: encounter.patient.prevision,
          registrationMode: encounter.patient.registrationMode,
          completenessStatus: encounter.patient.completenessStatus,
          demographicsMissingFields: getPatientDemographicsMissingFields(encounter.patient),
        }
      : undefined,
    createdBy: encounter.createdBy,
    reviewRequestedBy: encounter.reviewRequestedBy,
    reviewedBy: encounter.reviewedBy,
    completedBy: encounter.completedBy,
    progress: formatProgress(encounter.sections),
  };
}

export function formatEncounterForPatientList(encounter: any) {
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
    progress: formatProgress(encounter.sections),
  };
}

export function formatDashboardRecentEncounter(encounter: any) {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    patientName: encounter.patient.nombre,
    patientRut: encounter.patient.rut,
    createdByName: encounter.createdBy.nombre,
    status: encounter.status,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
    progress: formatProgress(encounter.sections),
  };
}

export function formatDashboardUpcomingTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    isOverdue: Boolean(task.dueDate && isDateOnlyBeforeToday(task.dueDate)),
    patient: task.patient,
    createdBy: task.createdBy,
  };
}

export function formatEncounterResponse(encounter: any, options: FormatEncounterResponseOptions = {}) {
  const { viewerRole } = options;
  const sortedSections = [...(encounter.sections || [])].sort((a: any, b: any) => {
    return SECTION_ORDER.indexOf(a.sectionKey) - SECTION_ORDER.indexOf(b.sectionKey);
  });
  const visibleSections = sortedSections.filter(
    (section: any) => !shouldHideEncounterSectionForRole(viewerRole, section.sectionKey as SectionKey),
  );

  const clinicalOutputBlock = getEncounterClinicalOutputBlock(encounter.patient);

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
    signatures: encounter.signatures,
    attachments: encounter.attachments,
    consents: encounter.consents,
    patient: encounter.patient
      ? {
          id: encounter.patient.id,
          rut: encounter.patient.rut,
          rutExempt: encounter.patient.rutExempt,
          rutExemptReason: encounter.patient.rutExemptReason,
          nombre: encounter.patient.nombre,
          fechaNacimiento: encounter.patient.fechaNacimiento,
          edad: encounter.patient.edad,
          edadMeses: encounter.patient.edadMeses,
          sexo: encounter.patient.sexo,
          trabajo: encounter.patient.trabajo,
          prevision: encounter.patient.prevision,
          registrationMode: encounter.patient.registrationMode,
          completenessStatus: encounter.patient.completenessStatus,
          demographicsVerifiedAt: encounter.patient.demographicsVerifiedAt ?? null,
          domicilio: encounter.patient.domicilio,
          centroMedico: encounter.patient.centroMedico,
          createdAt: encounter.patient.createdAt,
          updatedAt: encounter.patient.updatedAt,
          demographicsMissingFields: getPatientDemographicsMissingFields(encounter.patient),
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
      label: SECTION_LABELS[section.sectionKey as SectionKey],
      order: SECTION_ORDER.indexOf(section.sectionKey as SectionKey),
    })),
  };
}
