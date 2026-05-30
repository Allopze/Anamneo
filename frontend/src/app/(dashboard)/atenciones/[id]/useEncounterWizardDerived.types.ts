/**
 * Input/output type contracts for useEncounterWizardDerived.
 */

import type { ComponentType } from 'react';
import type { Attachment, Encounter, IdentificacionData, SectionKey, StructuredOrder } from '@/types';
import type { User } from '@/stores/auth-store';
import type { getPatientCompletenessMeta } from '@/lib/patient';
import type { SECTION_STATUS_META } from './encounter-wizard.constants';
import type { SectionUiState } from './encounter-wizard.constants';

export type SectionType = NonNullable<Encounter['sections']>[number];

export type UploadMeta = {
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
  lastSaveOrigin: 'direct' | 'offline-sync' | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'queued' | 'error';
  hasUnsavedChanges: boolean;
  dirtySectionKeys?: readonly SectionKey[];
  savingSectionKey: SectionKey | null;
  errorSectionKey: SectionKey | null;
  savedSectionKey: SectionKey | null;
  attachments: Attachment[];
  uploadMeta: UploadMeta;
  pendingSaveCount: number;
}

export interface UseEncounterWizardDerivedState {
  isDoctor: boolean;
  canEdit: boolean;
  canUpload: boolean;
  canDeleteAttachments: boolean;
  canComplete: boolean;
  canSign: boolean;
  canRequestMedicalReview: boolean;
  canMarkReviewedByDoctor: boolean;
  canWriteReviewNote: boolean;
  canViewAudit: boolean;
  canCreateFollowupTask: boolean;
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
  lastSavedTimeStr: string | null;
  saveStateLabel: string | null;
  saveStateToneClass: string;
}
