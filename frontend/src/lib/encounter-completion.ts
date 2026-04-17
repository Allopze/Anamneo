import type { Encounter, SectionKey } from '@/types';
import { getEncounterClinicalOutputBlockReason } from '@/lib/clinical-output';

export const WORKFLOW_NOTE_MIN_LENGTH = 10;

export type EncounterWorkflowChecklistStatus = 'ready' | 'blocked';

export interface EncounterWorkflowChecklistItem {
  id: string;
  label: string;
  detail: string;
  status: EncounterWorkflowChecklistStatus;
}

export interface EncounterSignatureDiffFieldChange {
  path: string;
  label: string;
  before: string;
  after: string;
}

export interface EncounterSignatureDiffSection {
  sectionKey: SectionKey;
  label: string;
  status: 'new' | 'changed';
  fieldChanges: EncounterSignatureDiffFieldChange[];
}

export interface EncounterSignatureAttachmentChange {
  kind: 'added' | 'removed';
  label: string;
}

export interface EncounterSignatureDiff {
  baselineEncounterId: string | null;
  baselineCreatedAt: string | null;
  hasChanges: boolean;
  totalChanges: number;
  sections: EncounterSignatureDiffSection[];
  attachmentChanges: EncounterSignatureAttachmentChange[];
}

const REQUIRED_COMPLETION_SECTION_KEYS: SectionKey[] = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

const REQUIRED_SEMANTIC_SECTION_KEYS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

const ENCOUNTER_WORKFLOW_SECTION_LABELS: Record<SectionKey, string> = {
  IDENTIFICACION: 'Identificación',
  MOTIVO_CONSULTA: 'Motivo de consulta',
  ANAMNESIS_PROXIMA: 'Anamnesis próxima',
  ANAMNESIS_REMOTA: 'Anamnesis remota',
  REVISION_SISTEMAS: 'Revisión por sistemas',
  EXAMEN_FISICO: 'Examen físico',
  SOSPECHA_DIAGNOSTICA: 'Sospecha diagnóstica',
  TRATAMIENTO: 'Tratamiento',
  RESPUESTA_TRATAMIENTO: 'Respuesta al tratamiento',
  OBSERVACIONES: 'Observaciones',
};

function hasMeaningfulContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulContent(item));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulContent(item));
  }

  return false;
}

function formatSectionKeyList(sectionKeys: SectionKey[]) {
  return sectionKeys.map((key) => ENCOUNTER_WORKFLOW_SECTION_LABELS[key]).join(', ');
}

function formatDiffPathLabel(path: string) {
  return path
    .split('.')
    .map((segment) => {
      if (/^\d+$/.test(segment)) {
        return `#${segment}`;
      }

      const normalized = segment
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(' > ');
}

function flattenMeaningfulValues(value: unknown, prefix = '', output: Record<string, string> = {}) {
  if (value === null || value === undefined) {
    return output;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) {
      output[prefix || 'value'] = normalized;
    }
    return output;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    output[prefix || 'value'] = String(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenMeaningfulValues(item, prefix ? `${prefix}.${index + 1}` : String(index + 1), output);
    });
    return output;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, nestedValue]) => {
        flattenMeaningfulValues(nestedValue, prefix ? `${prefix}.${key}` : key, output);
      });
  }

  return output;
}

function buildAttachmentSignatureLabel(attachment: NonNullable<Encounter['attachments']>[number]) {
  return (
    attachment.linkedOrderLabel?.trim()
    || attachment.description?.trim()
    || attachment.originalName?.trim()
    || 'Adjunto sin nombre'
  );
}

export function normalizeClosureNoteForCompletion(closureNote: string): string {
  return closureNote.trim();
}

export function normalizeReviewNoteForWorkflow(reviewNote: string): string {
  return reviewNote.trim();
}

export function hasRequiredWorkflowNote(note: string, minLength: number = WORKFLOW_NOTE_MIN_LENGTH): boolean {
  return note.trim().length >= minLength;
}

export function buildRequiredWorkflowNoteError(label: string, minLength: number = WORKFLOW_NOTE_MIN_LENGTH): string {
  return `${label} debe tener al menos ${minLength} caracteres`;
}

export function buildEncounterCompletionChecklist(
  encounter: Encounter | undefined,
  closureNote: string,
): EncounterWorkflowChecklistItem[] {
  const sections = encounter?.sections ?? [];
  const sectionByKey = new Map(sections.map((section) => [section.sectionKey, section]));
  const incompleteSections = REQUIRED_COMPLETION_SECTION_KEYS.filter((key) => !sectionByKey.get(key)?.completed);
  const semanticallyIncompleteSections = REQUIRED_SEMANTIC_SECTION_KEYS.filter(
    (key) => !hasMeaningfulContent(sectionByKey.get(key)?.data),
  );
  const blockReason = getEncounterClinicalOutputBlockReason(encounter?.clinicalOutputBlock, 'COMPLETE_ENCOUNTER');
  const closureNoteReady = hasRequiredWorkflowNote(closureNote);

  return [
    {
      id: 'required-sections',
      label: 'Secciones obligatorias completas',
      status: incompleteSections.length === 0 ? 'ready' : 'blocked',
      detail:
        incompleteSections.length === 0
          ? `${REQUIRED_COMPLETION_SECTION_KEYS.length} de ${REQUIRED_COMPLETION_SECTION_KEYS.length} listas para cierre.`
          : `Faltan: ${formatSectionKeyList(incompleteSections)}.`,
    },
    {
      id: 'clinical-content',
      label: 'Contenido clínico esencial',
      status: semanticallyIncompleteSections.length === 0 ? 'ready' : 'blocked',
      detail:
        semanticallyIncompleteSections.length === 0
          ? 'Las secciones clínicas obligatorias tienen contenido útil para el cierre.'
          : `Revisar contenido en: ${formatSectionKeyList(semanticallyIncompleteSections)}.`,
    },
    {
      id: 'closure-note',
      label: 'Nota de cierre',
      status: closureNoteReady ? 'ready' : 'blocked',
      detail: closureNoteReady
        ? 'Lista para persistirse con el cierre.'
        : buildRequiredWorkflowNoteError('La nota de cierre'),
    },
    {
      id: 'patient-record',
      label: 'Ficha maestra habilitada para cierre',
      status: blockReason ? 'blocked' : 'ready',
      detail: blockReason ?? 'La ficha administrativa permite cierre y documentos clínicos oficiales.',
    },
  ];
}

export function buildEncounterSignatureSummary(encounter: Encounter | undefined) {
  const sectionTotal = encounter?.sections?.length ?? 0;
  const completedSections = encounter?.sections?.filter((section) => section.completed).length ?? 0;
  const attachmentCount = encounter?.attachments?.length ?? 0;
  const reviewStatus = encounter?.reviewStatus ?? 'NO_REQUIERE_REVISION';

  return [
    {
      id: 'sections',
      label: 'Secciones completas',
      value: `${completedSections}/${sectionTotal}`,
    },
    {
      id: 'review',
      label: 'Estado de revisión',
      value:
        reviewStatus === 'REVISADA_POR_MEDICO'
          ? 'Revisada por médico'
          : reviewStatus === 'LISTA_PARA_REVISION'
            ? 'Pendiente de revisión'
            : 'No requiere revisión',
    },
    {
      id: 'closure-note',
      label: 'Nota de cierre',
      value: encounter?.closureNote?.trim() ? 'Incluida' : 'Sin nota de cierre',
    },
    {
      id: 'attachments',
      label: 'Adjuntos incluidos',
      value: attachmentCount === 0 ? 'Sin adjuntos' : `${attachmentCount} adjunto${attachmentCount === 1 ? '' : 's'}`,
    },
  ];
}

export function buildEncounterSignatureDiff(encounter: Encounter | undefined): EncounterSignatureDiff {
  const baseline = encounter?.signatureBaseline ?? null;
  const currentSections = encounter?.sections ?? [];
  const baselineSectionByKey = new Map((baseline?.sections ?? []).map((section) => [section.sectionKey, section]));
  const sections: EncounterSignatureDiffSection[] = [];

  for (const currentSection of currentSections) {
    const baselineSection = baselineSectionByKey.get(currentSection.sectionKey);
    const currentFlat = flattenMeaningfulValues(currentSection.data);
    const baselineFlat = flattenMeaningfulValues(baselineSection?.data);
    const paths = [...new Set([...Object.keys(currentFlat), ...Object.keys(baselineFlat)])].sort((left, right) =>
      left.localeCompare(right),
    );

    const fieldChanges = paths
      .map((path) => {
        const before = baselineFlat[path] ?? 'Sin registro previo';
        const after = currentFlat[path] ?? 'Sin valor';
        if (before === after) {
          return null;
        }

        return {
          path,
          label: formatDiffPathLabel(path),
          before,
          after,
        } satisfies EncounterSignatureDiffFieldChange;
      })
      .filter((item): item is EncounterSignatureDiffFieldChange => item !== null);

    if (fieldChanges.length > 0) {
      sections.push({
        sectionKey: currentSection.sectionKey,
        label: currentSection.label,
        status: baselineSection ? 'changed' : 'new',
        fieldChanges,
      });
    }
  }

  const currentAttachments = new Map(
    (encounter?.attachments ?? []).map((attachment) => [
      `${attachment.originalName}|${attachment.linkedOrderType ?? ''}|${attachment.linkedOrderId ?? ''}|${attachment.description ?? ''}`,
      buildAttachmentSignatureLabel(attachment),
    ]),
  );
  const baselineAttachments = new Map(
    (baseline?.attachments ?? []).map((attachment) => [
      `${attachment.originalName}|${attachment.linkedOrderType ?? ''}|${attachment.linkedOrderId ?? ''}|${attachment.description ?? ''}`,
      buildAttachmentSignatureLabel(attachment),
    ]),
  );

  const attachmentChanges: EncounterSignatureAttachmentChange[] = [];
  for (const [key, label] of currentAttachments) {
    if (!baselineAttachments.has(key)) {
      attachmentChanges.push({ kind: 'added', label });
    }
  }
  for (const [key, label] of baselineAttachments) {
    if (!currentAttachments.has(key)) {
      attachmentChanges.push({ kind: 'removed', label });
    }
  }

  const totalChanges =
    sections.reduce((sum, section) => sum + section.fieldChanges.length, 0) + attachmentChanges.length;

  return {
    baselineEncounterId: baseline?.id ?? null,
    baselineCreatedAt: baseline?.createdAt ?? null,
    hasChanges: totalChanges > 0,
    totalChanges,
    sections,
    attachmentChanges,
  };
}
