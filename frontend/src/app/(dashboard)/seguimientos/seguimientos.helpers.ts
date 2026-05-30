import type { PatientTask } from '@/types';
import { extractDateOnly } from '@/lib/date';

export const STATUS_OPTIONS = ['', 'PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as const;
export const TYPE_OPTIONS = ['', 'SEGUIMIENTO', 'EXAMEN', 'DERIVACION', 'TRAMITE'] as const;
export const PRIORITY_OPTIONS = ['', 'ALTA', 'MEDIA', 'BAJA'] as const;

export function addDaysToDateOnly(days: number) {
  return extractDateOnly(new Date(Date.now() + days * 24 * 60 * 60 * 1000)) || '';
}

export function priorityBadgeClassName(priority: PatientTask['priority']) {
  if (priority === 'ALTA') return 'bg-status-red/15 text-status-red';
  if (priority === 'MEDIA') return 'bg-status-yellow/30 text-accent-text';
  return 'bg-surface-muted text-ink-secondary';
}
