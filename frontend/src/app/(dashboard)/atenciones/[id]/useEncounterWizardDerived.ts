import { useCallback, useMemo } from 'react';
import type { ComponentType } from 'react';
import type { Attachment, Encounter, IdentificacionData, SectionKey, StructuredOrder, TratamientoData } from '@/types';
import type { User } from '@/stores/auth-store';
import { buildGeneratedClinicalSummary } from '@/lib/clinical';
import {
  formatPatientMissingFields,
  getIdentificationMissingFields,
  getPatientCompletenessMeta,
} from '@/lib/patient';
import { getEncounterClinicalOutputBlockReason } from '@/lib/clinical-output';
import {
  canCompleteEncounter as canCompleteEncounterPermission,
  canEditEncounter,
  canUploadAttachments as canUploadAttachmentsPermission,
  canViewMedicoOnlySections,
} from '@/lib/permissions';
import { buildEncounterDrawerShortcutHint } from '@/lib/encounter-drawer-shortcut';
import type { SectionUiState } from './encounter-wizard.constants';
import {
  MEDICO_ONLY_SECTIONS,
  SECTION_COMPONENTS,
  SECTION_STATUS_META,
  TEMPLATE_FIELD_BY_SECTION,
} from './encounter-wizard.constants';

type SectionType = NonNullable<Encounter['sections']>[number];

type UploadMeta = {
  category: string;
  description: string;
  linkedOrderType: string;
  linkedOrderId: string;
};

export interface UseEncounterWizardDerivedInput {
  user: User | null;
  encounter: Encounter | undefined;
  currentSectionIndex: number;
  sections?: SectionType[];
  currentSection?: SectionType | undefined;
  formData: Record<string, any>;
  savedSnapshotJson: string;
  lastSavedAt: Date | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  hasUnsavedChanges: boolean;
  savingSectionKey: SectionKey | null;
  errorSectionKey: SectionKey | null;
  savedSectionKey: SectionKey | null;
  attachments: Attachment[];
  uploadMeta: UploadMeta;
}

export interface UseEncounterWizardDerivedState {
  isDoctor: boolean;
  canEdit: boolean;
  canUpload: boolean;
  canComplete: boolean;
  sections: SectionType[];
  currentSection: SectionType | undefined;
  SectionComponent: ComponentType<any> | null;
  completedCount: number;
  progressPercentage: number;
  currentLinkedOrderType: 'EXAMEN' | 'DERIVACION' | '';
  currentLinkableOrders: StructuredOrder[];
  linkedAttachmentsByOrderId: Record<string, Attachment[]>;
  generatedSummary: string;
  savedSnapshot: Record<string, any>;
  getSectionUiState: (section: SectionType) => SectionUiState;
  currentSectionState: SectionUiState;
  currentSectionStatusMeta: (typeof SECTION_STATUS_META)[SectionUiState];
  identificationSnapshotStatus: Encounter['identificationSnapshotStatus'];
  identificationData: IdentificacionData;
  patientCompletenessMeta: ReturnType<typeof getPatientCompletenessMeta> | null;
  identificationMissingFields: string[];
  clinicalOutputBlockReason: string | null;
  completionBlockedReason: string | null;
  supportsTemplates: boolean;
  drawerShortcutHint: string;
  lastSavedTimeStr: string | null;
  saveStateLabel: string | null;
  saveStateToneClass: string;
}

export function useEncounterWizardDerived(input: UseEncounterWizardDerivedInput): UseEncounterWizardDerivedState {
  const {
    user,
    encounter,
    currentSectionIndex,
    sections: providedSections,
    currentSection: providedCurrentSection,
    formData,
    savedSnapshotJson,
    lastSavedAt,
    saveStatus,
    hasUnsavedChanges,
    savingSectionKey,
    errorSectionKey,
    savedSectionKey,
    attachments,
    uploadMeta,
  } = input;

  const drawerShortcutHint = useMemo(() => buildEncounterDrawerShortcutHint(), []);

  const isDoctor = user?.role === 'MEDICO';
  const canEdit = canEditEncounter(user ?? null, encounter);
  const canUpload = canUploadAttachmentsPermission(user ?? null);
  const canComplete = canCompleteEncounterPermission(user ?? null, encounter);

  const sections = useMemo(() => {
    if (providedSections) {
      return providedSections;
    }

    const source = encounter?.sections ?? [];
    return canViewMedicoOnlySections(user ?? null)
      ? source
      : source.filter((section) => !MEDICO_ONLY_SECTIONS.includes(section.sectionKey));
  }, [encounter?.sections, providedSections, user]);

  const currentSection = providedCurrentSection ?? sections[currentSectionIndex];

  const savedSnapshot = useMemo(() => {
    try {
      return JSON.parse(savedSnapshotJson || '{}') as Record<string, any>;
    } catch {
      return {};
    }
  }, [savedSnapshotJson]);

  const getSectionUiState = useCallback(
    (section: SectionType): SectionUiState => {
      if (section.sectionKey === savingSectionKey) return 'saving';
      if (section.sectionKey === errorSectionKey) return 'error';
      const currentData = JSON.stringify(formData[section.sectionKey] ?? {});
      const savedData = JSON.stringify(savedSnapshot[section.sectionKey] ?? {});
      if (currentData !== savedData) return 'dirty';
      if (section.notApplicable) return 'notApplicable';
      if (section.completed) return 'completed';
      if (section.sectionKey === savedSectionKey) return 'saved';
      return 'idle';
    },
    [errorSectionKey, formData, savedSectionKey, savedSnapshot, savingSectionKey],
  );

  const currentSectionState = currentSection ? getSectionUiState(currentSection) : 'idle';
  const currentSectionStatusMeta = SECTION_STATUS_META[currentSectionState];
  const completedCount = useMemo(() => sections.filter((section) => section.completed).length, [sections]);
  const progressPercentage = sections.length > 0 ? (completedCount / sections.length) * 100 : 0;

  const generatedSummary = useMemo(() => {
    if (!encounter) return '';
    return buildGeneratedClinicalSummary({
      ...encounter,
      sections: sections.map((section) => ({
        ...section,
        data: formData[section.sectionKey] ?? section.data,
      })),
    } as Encounter);
  }, [encounter, formData, sections]);

  const currentLinkedOrderType =
    uploadMeta.category === 'EXAMEN' ? 'EXAMEN' : uploadMeta.category === 'DERIVACION' ? 'DERIVACION' : '';

  const treatmentData = (formData.TRATAMIENTO ??
    encounter?.sections?.find((section) => section.sectionKey === 'TRATAMIENTO')?.data ??
    {}) as TratamientoData;

  const examenesEstructurados = useMemo(
    () => (Array.isArray(treatmentData.examenesEstructurados) ? treatmentData.examenesEstructurados : []),
    [treatmentData.examenesEstructurados],
  );
  const derivacionesEstructuradas = useMemo(
    () => (Array.isArray(treatmentData.derivacionesEstructuradas) ? treatmentData.derivacionesEstructuradas : []),
    [treatmentData.derivacionesEstructuradas],
  );

  const currentLinkableOrders: StructuredOrder[] = useMemo(
    () =>
      currentLinkedOrderType === 'EXAMEN'
        ? examenesEstructurados
        : currentLinkedOrderType === 'DERIVACION'
          ? derivacionesEstructuradas
          : [],
    [currentLinkedOrderType, derivacionesEstructuradas, examenesEstructurados],
  );

  const linkedAttachmentsByOrderId = useMemo(
    () =>
      attachments.reduce<Record<string, Attachment[]>>((accumulator, attachment) => {
        if (!attachment.linkedOrderId) return accumulator;
        if (!accumulator[attachment.linkedOrderId]) accumulator[attachment.linkedOrderId] = [];
        accumulator[attachment.linkedOrderId].push(attachment);
        return accumulator;
      }, {}),
    [attachments],
  );

  const identificationData = (formData.IDENTIFICACION ??
    encounter?.sections?.find((section) => section.sectionKey === 'IDENTIFICACION')?.data ??
    {}) as IdentificacionData;
  const identificationSnapshotStatus = encounter?.identificationSnapshotStatus;
  const patientCompletenessMeta = encounter?.patient ? getPatientCompletenessMeta(encounter.patient) : null;
  const identificationMissingFields = formatPatientMissingFields(getIdentificationMissingFields(identificationData));
  const clinicalOutputBlockReason = encounter?.clinicalOutputBlock?.reason ?? null;
  const completionBlockedReason = getEncounterClinicalOutputBlockReason(
    encounter?.clinicalOutputBlock,
    'COMPLETE_ENCOUNTER',
  );
  const supportsTemplates = Boolean(currentSection && TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey]);

  const lastSavedTimeStr = lastSavedAt
    ? lastSavedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : null;

  const saveStateLabel = canEdit
    ? saveStatus === 'saving'
      ? 'Guardando…'
      : saveStatus === 'saved'
        ? 'Cambios guardados'
        : saveStatus === 'error'
          ? 'Error al guardar'
          : hasUnsavedChanges
            ? 'Cambios sin guardar'
            : lastSavedTimeStr
              ? `Guardado a las ${lastSavedTimeStr}`
              : 'Sin cambios'
    : null;

  const saveStateToneClass =
    saveStatus === 'error'
      ? 'text-status-red-text'
      : saveStatus === 'saved'
        ? 'text-status-green-text'
        : saveStatus === 'saving'
          ? 'text-ink'
          : 'text-ink-secondary';

  return {
    isDoctor,
    canEdit,
    canUpload,
    canComplete,
    sections,
    currentSection,
    SectionComponent: currentSection ? SECTION_COMPONENTS[currentSection.sectionKey] : null,
    completedCount,
    progressPercentage,
    currentLinkedOrderType,
    currentLinkableOrders,
    linkedAttachmentsByOrderId,
    generatedSummary,
    savedSnapshot,
    getSectionUiState,
    currentSectionState,
    currentSectionStatusMeta,
    identificationSnapshotStatus,
    identificationData,
    patientCompletenessMeta,
    identificationMissingFields,
    clinicalOutputBlockReason,
    completionBlockedReason,
    supportsTemplates,
    drawerShortcutHint,
    lastSavedTimeStr,
    saveStateLabel,
    saveStateToneClass,
  };
}