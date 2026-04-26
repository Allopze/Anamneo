import { FiActivity, FiClipboard, FiClock, FiFileText } from 'react-icons/fi';
import type { Encounter } from '@/types';
import type { EncounterWorkflowChecklistItem } from '@/lib/encounter-completion';

/* ─── styling constants ─── */
export const SURFACE_PANEL_CLASS = 'overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-soft';
export const INNER_PANEL_CLASS = 'rounded-card border border-surface-muted/45 bg-surface-base/55';

/* ─── tab definition ─── */
export const SIDEBAR_TABS = [
  { key: 'revision' as const, label: 'Revisión', shortLabel: 'Rev.', icon: FiActivity },
  { key: 'apoyo' as const, label: 'Apoyo', shortLabel: 'Apoyo', icon: FiClipboard },
  { key: 'cierre' as const, label: 'Cierre', shortLabel: 'Cierre', icon: FiFileText },
  { key: 'historial' as const, label: 'Historial', shortLabel: 'Hist.', icon: FiClock },
] as const;

export type SidebarTabKey = (typeof SIDEBAR_TABS)[number]['key'];

/* ─── date formatters ─── */
const headerDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const compactDateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
export function formatDateTime(d: string | Date) {
  return headerDateFormatter.format(new Date(d));
}
export function formatCompactDate(d: string | Date) {
  return compactDateFormatter.format(new Date(d));
}

/* ─── props ─── */
export interface EncounterDrawerProps {
  open: boolean;
  onClose: () => void;
  tab: SidebarTabKey;
  onTabChange: (tab: SidebarTabKey) => void;

  encounter: Encounter;
  canEdit: boolean;
  canComplete: boolean;
  canRequestMedicalReview: boolean;
  canMarkReviewedByDoctor: boolean;
  canWriteReviewNote: boolean;
  canViewAudit: boolean;
  canCreateFollowupTask: boolean;

  /* revision tab */
  reviewActionNote: string;
  onReviewActionNoteChange: (value: string) => void;
  onReviewStatusChange: (status: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO') => void | Promise<void>;
  reviewStatusPending: boolean;
  generatedSummary: string;
  onSaveGeneratedSummary: () => void;

  /* apoyo tab */
  quickNotesValue: string;
  quickNotesDisabled: boolean;
  quickNotesSaving: boolean;
  onQuickNotesSave: (text: string) => void;
  onOpenAttachments: () => void;
  canEditAntecedentes: boolean;

  quickTask: { title: string; type: string; dueDate: string };
  onQuickTaskChange: (task: { title: string; type: string; dueDate: string }) => void;
  onCreateTask: () => void;
  createTaskPending: boolean;

  /* cierre tab */
  closureNote: string;
  onClosureNoteChange: (value: string) => void;
  completionChecklist: EncounterWorkflowChecklistItem[];
}
