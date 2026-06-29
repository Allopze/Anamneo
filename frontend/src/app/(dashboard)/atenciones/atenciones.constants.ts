import clsx from 'clsx';
import { STATUS_LABELS, REVIEW_STATUS_LABELS, Encounter } from '@/types';

export const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'EN_PROGRESO', label: STATUS_LABELS.EN_PROGRESO },
  { value: 'COMPLETADO', label: STATUS_LABELS.COMPLETADO },
  { value: 'CANCELADO', label: STATUS_LABELS.CANCELADO },
];

export const REVIEW_OPTIONS = [
  { value: '', label: 'Todas las revisiones' },
  { value: 'NO_REQUIERE_REVISION', label: REVIEW_STATUS_LABELS.NO_REQUIERE_REVISION },
  { value: 'LISTA_PARA_REVISION', label: REVIEW_STATUS_LABELS.LISTA_PARA_REVISION },
  { value: 'REVISADA_POR_MEDICO', label: REVIEW_STATUS_LABELS.REVISADA_POR_MEDICO },
];

export const PAGE_SIZE = 15;

export interface OperationalDashboardData {
  counts: {
    enProgreso: number;
    pendingReview: number;
    patientPendingVerification: number;
  };
}

export function getStatusChipClassName(status: Encounter['status']) {
  return clsx(
    'list-chip',
    status === 'COMPLETADO'
      ? 'bg-status-green/20 text-status-green'
      : status === 'EN_PROGRESO'
        ? 'border border-status-yellow/70 bg-status-yellow/35 text-accent-text'
        : 'bg-surface-base text-ink-secondary'
  );
}

export function getReviewChipClassName(reviewStatus?: Encounter['reviewStatus']) {
  return clsx(
    'list-chip',
    reviewStatus === 'REVISADA_POR_MEDICO'
      ? 'bg-frame text-white'
      : reviewStatus === 'LISTA_PARA_REVISION'
        ? 'border border-status-yellow/70 bg-status-yellow/30 text-accent-text'
        : 'bg-surface-inset text-ink-secondary'
  );
}
