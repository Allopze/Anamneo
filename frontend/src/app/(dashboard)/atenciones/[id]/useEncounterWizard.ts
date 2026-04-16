import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Encounter, SectionKey } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { getEncounterClinicalOutputBlockReason } from '@/lib/clinical-output';
import {
  canEditEncounter,
  canUploadAttachments as canUploadAttachmentsPermission,
  canViewMedicoOnlySections,
} from '@/lib/permissions';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import toast from 'react-hot-toast';
import type { SidebarTabKey } from '@/components/EncounterDrawer';
import {
  MEDICO_ONLY_SECTIONS,
  TEMPLATE_FIELD_BY_SECTION,
} from './encounter-wizard.constants';
import { useEncounterWizardDerived } from './useEncounterWizardDerived';
import { useEncounterAttachments } from './useEncounterAttachments';
import { useEncounterSectionPersistence } from './useEncounterSectionPersistence';
import { useEncounterWizardNavigation } from './useEncounterWizardNavigation';
import { useEncounterWorkflowActions } from './useEncounterWorkflowActions';

export function useEncounterWizard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditAntecedentes } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const [isSectionSwitchPending, startSectionTransition] = useTransition();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [showNotApplicableModal, setShowNotApplicableModal] = useState(false);
  const [notApplicableReason, setNotApplicableReason] = useState('');
  const isOnline = useOnlineStatus();

  const {
    data: encounter,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      const response = await api.get(`/encounters/${id}`);
      return response.data as Encounter;
    },
    enabled: !isOperationalAdmin,
  });

  useEffect(() => {
    if (!isOperationalAdmin) return;
    router.replace('/');
  }, [isOperationalAdmin, router]);

  useEffect(() => {
    if (!encounter?.createdAt) return;
    const calc = () => Math.max(0, Math.floor((Date.now() - new Date(encounter.createdAt).getTime()) / 60000));
    setElapsedMinutes(calc());
    const interval = setInterval(() => setElapsedMinutes(calc()), 60000);
    return () => clearInterval(interval);
  }, [encounter?.createdAt]);

  const isDoctor = isMedico();
  const canEdit = canEditEncounter(user ?? null, encounter);
  const canUpload = canUploadAttachmentsPermission(user ?? null);
  const allSections = encounter?.sections;
  const sections = useMemo(() => {
    const source = allSections ?? [];
    return canViewMedicoOnlySections(user ?? null)
      ? source
      : source.filter((section) => !MEDICO_ONLY_SECTIONS.includes(section.sectionKey));
  }, [allSections, user]);
  const currentSection = sections[currentSectionIndex];

  const persistence = useEncounterSectionPersistence({
    canEdit,
    currentSection,
    currentSectionIndex,
    encounter,
    id,
    isOnline,
    queryClient,
    sections,
    setCurrentSectionIndex,
    userId: user?.id,
  });

  const attachmentsState = useEncounterAttachments({
    id,
    queryClient,
    currentSectionKey: currentSection?.sectionKey,
  });

  const derived = useEncounterWizardDerived({
    user,
    encounter,
    currentSectionIndex,
    sections,
    currentSection,
    formData: persistence.formData,
    savedSnapshotJson: persistence.savedSnapshotJson,
    lastSavedAt: persistence.lastSavedAt,
    saveStatus: persistence.saveStatus,
    hasUnsavedChanges: persistence.hasUnsavedChanges,
    savingSectionKey: persistence.savingSectionKey,
    errorSectionKey: persistence.errorSectionKey,
    savedSectionKey: persistence.savedSectionKey,
    attachments: attachmentsState.attachments,
    uploadMeta: attachmentsState.uploadMeta,
  });

  const {
    canComplete,
    SectionComponent,
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
  } = derived;

  const navigation = useEncounterWizardNavigation({
    canEdit,
    currentSectionIndex,
    currentSection,
    hasUnsavedChanges: persistence.hasUnsavedChanges,
    saveCurrentSection: persistence.saveCurrentSection,
    persistSection: persistence.persistSection,
    sections,
    setCurrentSectionIndex,
    startSectionTransition,
  });

  const workflow = useEncounterWorkflowActions({
    canEdit,
    encounter,
    ensureActiveSectionSaved: persistence.ensureActiveSectionSaved,
    id,
    navigate: (href) => router.push(href),
    queryClient,
    userId: user?.id,
  });

  const insertTemplateIntoCurrentSection = (content: string) => {
    if (!currentSection || !canEdit) return;
    const targetField = TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey];
    if (!targetField) return;
    const currentData = persistence.formData[currentSection.sectionKey] || {};
    const existingValue = typeof currentData[targetField] === 'string' ? currentData[targetField].trim() : '';
    const nextValue = existingValue ? `${existingValue}\n\n${content}`.trim() : content;
    persistence.handleSectionDataChange(currentSection.sectionKey, { ...currentData, [targetField]: nextValue });
    toast.success('Plantilla insertada en la sección actual');
  };

  const handleMarkNotApplicable = () => {
    if (!canEdit || !currentSection) return;
    const REQUIRED: SectionKey[] = ['MOTIVO_CONSULTA', 'EXAMEN_FISICO', 'SOSPECHA_DIAGNOSTICA', 'TRATAMIENTO'];
    if (REQUIRED.includes(currentSection.sectionKey)) {
      toast.error('Esta sección es obligatoria y no se puede marcar como "No aplica"');
      return;
    }
    setNotApplicableReason('');
    setShowNotApplicableModal(true);
  };

  const handleConfirmNotApplicable = async () => {
    if (!currentSection) return;
    if (notApplicableReason.trim().length < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres');
      return;
    }
    const sectionKey = currentSection.sectionKey;
    const currentData = persistence.formData[sectionKey] ?? {};
    try {
      await persistence.saveSectionMutation.mutateAsync({
        sectionKey,
        data: currentData,
        completed: true,
        notApplicable: true,
        notApplicableReason: notApplicableReason.trim(),
      });
      setShowNotApplicableModal(false);
      toast.success('Sección marcada como no aplica');
    } catch {
      // onError handler already surfaces UI feedback
    }
  };

  const handleSaveGeneratedSummary = useCallback(() => {
    persistence.handleSaveGeneratedSummary(generatedSummary);
  }, [generatedSummary, persistence]);

  return {
    id,
    encounter,
    isLoading,
    error,
    isOperationalAdmin,
    isDoctor,
    canEdit,
    canUpload,
    canComplete,
    canEditAntecedentes,
    sections,
    currentSectionIndex,
    currentSection,
    SectionComponent,
    formData: persistence.formData,
    isSectionSwitchPending,
    hasUnsavedChanges: persistence.hasUnsavedChanges,
    saveStatus: persistence.saveStatus,
    saveStateLabel,
    saveStateToneClass,
    savingSectionKey: persistence.savingSectionKey,
    savedSectionKey: persistence.savedSectionKey,
    currentSectionState,
    currentSectionStatusMeta,
    getSectionUiState,
    savedSnapshot,
    elapsedMinutes,
    isAttachmentsOpen: attachmentsState.isAttachmentsOpen,
    setIsAttachmentsOpen: attachmentsState.setIsAttachmentsOpen,
    selectedFile: attachmentsState.selectedFile,
    setSelectedFile: attachmentsState.setSelectedFile,
    uploadError: attachmentsState.uploadError,
    setUploadError: attachmentsState.setUploadError,
    uploadMeta: attachmentsState.uploadMeta,
    setUploadMeta: attachmentsState.setUploadMeta,
    showCompleteConfirm: workflow.showCompleteConfirm,
    setShowCompleteConfirm: workflow.setShowCompleteConfirm,
    showSignModal: workflow.showSignModal,
    setShowSignModal: workflow.setShowSignModal,
    showDeleteAttachment: attachmentsState.showDeleteAttachment,
    setShowDeleteAttachment: attachmentsState.setShowDeleteAttachment,
    showNotApplicableModal,
    setShowNotApplicableModal,
    previewAttachment: attachmentsState.previewAttachment,
    setPreviewAttachment: attachmentsState.setPreviewAttachment,
    notApplicableReason,
    setNotApplicableReason,
    railCompletedCollapsed: navigation.railCompletedCollapsed,
    setRailCompletedCollapsed: navigation.setRailCompletedCollapsed,
    railCollapsed: navigation.railCollapsed,
    setRailCollapsed: navigation.setRailCollapsed,
    sidebarTab: navigation.sidebarTab,
    setSidebarTab: navigation.setSidebarTab,
    isDrawerOpen: navigation.isDrawerOpen,
    setIsDrawerOpen: navigation.setIsDrawerOpen,
    drawerShortcutHint,
    isOnline,
    pendingSaveCount: persistence.pendingSaveCount,
    completedCount,
    progressPercentage,
    attachments: attachmentsState.attachments,
    attachmentsQuery: attachmentsState.attachmentsQuery,
    currentLinkedOrderType,
    currentLinkableOrders,
    linkedAttachmentsByOrderId,
    supportsTemplates,
    generatedSummary,
    identificationSnapshotStatus,
    identificationData,
    patientCompletenessMeta,
    identificationMissingFields,
    clinicalOutputBlockReason,
    completionBlockedReason,
    quickTask: workflow.quickTask,
    setQuickTask: workflow.setQuickTask,
    reviewActionNote: workflow.reviewActionNote,
    setReviewActionNote: workflow.setReviewActionNote,
    closureNote: workflow.closureNote,
    setClosureNote: workflow.setClosureNote,
    saveSectionMutation: persistence.saveSectionMutation,
    completeMutation: workflow.completeMutation,
    signMutation: workflow.signMutation,
    uploadMutation: attachmentsState.uploadMutation,
    deleteMutation: attachmentsState.deleteMutation,
    reviewStatusMutation: workflow.reviewStatusMutation,
    createTaskMutation: workflow.createTaskMutation,
    saveCurrentSection: persistence.saveCurrentSection,
    persistSection: persistence.persistSection,
    handleSectionDataChange: persistence.handleSectionDataChange,
    handleNavigate: navigation.handleNavigate,
    handleComplete: workflow.handleComplete,
    confirmComplete: workflow.confirmComplete,
    handleMarkNotApplicable,
    handleConfirmNotApplicable,
    handleReviewStatusChange: workflow.handleReviewStatusChange,
    handleDownload: attachmentsState.handleDownload,
    handleRestoreIdentificationFromPatient: persistence.handleRestoreIdentificationFromPatient,
    handleStartLinkedAttachment: attachmentsState.handleStartLinkedAttachment,
    insertTemplateIntoCurrentSection,
    moveToSection: navigation.moveToSection,
    openDrawerTab: navigation.openDrawerTab,
    handleSaveGeneratedSummary,
    handleQuickNotesSave: persistence.handleQuickNotesSave,
    handleViewFicha: workflow.handleViewFicha,
  };
}

export type EncounterWizardHook = ReturnType<typeof useEncounterWizard>;
