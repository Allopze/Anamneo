import { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Encounter } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import {
  canEditEncounter,
  canViewEncounterSection,
  canUploadAttachments as canUploadAttachmentsPermission,
} from '@/lib/permissions';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { buildEncounterCompletionChecklist } from '@/lib/encounter-completion';
import { useEncounterWizardDerived } from './useEncounterWizardDerived';
import { useEncounterAttachments } from './useEncounterAttachments';
import { useEncounterSectionPersistence } from './useEncounterSectionPersistence';
import { useEncounterWizardNavigation } from './useEncounterWizardNavigation';
import { useEncounterWorkflowActions } from './useEncounterWorkflowActions';
import { useEncounterWizardSectionActions } from './useEncounterWizardSectionActions';
import { useDuplicateEncounterAction } from './useDuplicateEncounterAction';

export function useEncounterWizard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditAntecedentes } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const [isSectionSwitchPending, startSectionTransition] = useTransition();

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
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
  const canUpload = canUploadAttachmentsPermission(user ?? null, encounter);
  const duplicateAction = useDuplicateEncounterAction(encounter);
  const allSections = encounter?.sections;
  const sections = useMemo(() => {
    const source = allSections ?? [];
    return source.filter((section) => canViewEncounterSection(user ?? null, section.sectionKey));
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
    canDeleteAttachments,
    canComplete,
    canSign,
    canRequestMedicalReview,
    canMarkReviewedByDoctor,
    canWriteReviewNote,
    canViewAudit,
    canCreateFollowupTask,
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
    isSaving: persistence.saveSectionMutation.isPending,
    saveCurrentSection: persistence.saveCurrentSection,
    persistSection: persistence.persistSection,
    sections,
    setCurrentSectionIndex,
    startSectionTransition,
  });

  const workflow = useEncounterWorkflowActions({
    canEdit,
    canCreateFollowupTask,
    canRequestMedicalReview,
    canMarkReviewedByDoctor,
    encounter,
    ensureActiveSectionSaved: persistence.ensureActiveSectionSaved,
    id,
    navigate: (href) => router.push(href),
    queryClient,
    userId: user?.id,
  });
  const completionChecklist = useMemo(
    () => buildEncounterCompletionChecklist(encounter, workflow.closureNote),
    [encounter, workflow.closureNote],
  );

  const sectionActions = useEncounterWizardSectionActions({
    canEdit,
    currentSection,
    formData: persistence.formData,
    handleSectionDataChange: persistence.handleSectionDataChange,
    saveSectionMutation: persistence.saveSectionMutation,
  });

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
    canDuplicateEncounter: duplicateAction.canDuplicateEncounter,
    canDeleteAttachments,
    canComplete,
    canSign,
    canRequestMedicalReview,
    canMarkReviewedByDoctor,
    canWriteReviewNote,
    canViewAudit,
    canCreateFollowupTask,
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
    showNotApplicableModal: sectionActions.showNotApplicableModal,
    setShowNotApplicableModal: sectionActions.setShowNotApplicableModal,
    previewAttachment: attachmentsState.previewAttachment,
    setPreviewAttachment: attachmentsState.setPreviewAttachment,
    notApplicableReason: sectionActions.notApplicableReason,
    setNotApplicableReason: sectionActions.setNotApplicableReason,
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
    completionChecklist,
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
    duplicateEncounterMutation: duplicateAction.duplicateEncounterMutation,
    saveCurrentSection: persistence.saveCurrentSection,
    persistSection: persistence.persistSection,
    handleSectionDataChange: persistence.handleSectionDataChange,
    handleNavigate: navigation.handleNavigate,
    handleComplete: workflow.handleComplete,
    confirmComplete: workflow.confirmComplete,
    handleMarkNotApplicable: sectionActions.handleMarkNotApplicable,
    handleConfirmNotApplicable: sectionActions.handleConfirmNotApplicable,
    handleReviewStatusChange: workflow.handleReviewStatusChange,
    handleCreateTask: workflow.handleCreateTask,
    handleDuplicateEncounter: duplicateAction.handleDuplicateEncounter,
    handleDownload: attachmentsState.handleDownload,
    handleRestoreIdentificationFromPatient: persistence.handleRestoreIdentificationFromPatient,
    handleStartLinkedAttachment: attachmentsState.handleStartLinkedAttachment,
    insertTemplateIntoCurrentSection: sectionActions.insertTemplateIntoCurrentSection,
    moveToSection: navigation.moveToSection,
    openDrawerTab: navigation.openDrawerTab,
    handleSaveGeneratedSummary,
    handleQuickNotesSave: persistence.handleQuickNotesSave,
    handleViewFicha: workflow.handleViewFicha,
  };
}

export type EncounterWizardHook = ReturnType<typeof useEncounterWizard>;
