'use client';

import Link from 'next/link';
import type { UseMutationResult } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  FiAlertTriangle,
  FiCalendar,
  FiChevronRight,
  FiClipboard,
  FiSave,
} from 'react-icons/fi';
import type { PatientTask } from '@/types';
import {
  TASK_PRIORITY_LABELS,
  TASK_RECURRENCE_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/types';
import LocalizedDateInput from '@/components/common/LocalizedDateInput';
import { extractDateOnly, formatDateOnly } from '@/lib/date';
import { notify } from '@/lib/notify';
import { addDaysToDateOnly, priorityBadgeClassName } from './seguimientos.helpers';

interface Props {
  task: PatientTask;
  rescheduleDrafts: Record<string, string>;
  isPending: boolean;
  onRescheduleDraftChange: (taskId: string, date: string) => void;
  onReschedule: (taskId: string, dueDate: string) => void;
}

export function SeguimientoTaskRow({
  task,
  rescheduleDrafts,
  isPending,
  onRescheduleDraftChange,
  onReschedule,
}: Props) {
  const handleQuickReschedule = (days: number) => {
    const nextDate = addDaysToDateOnly(days);
    onRescheduleDraftChange(task.id, nextDate);
    onReschedule(task.id, nextDate);
  };

  const handleSaveReschedule = () => {
    const selectedDate =
      rescheduleDrafts[task.id] ?? extractDateOnly(task.dueDate) ?? '';
    if (!selectedDate) {
      notify.error('Debe elegir una fecha');
      return;
    }
    onReschedule(task.id, selectedDate);
  };

  return (
    <div className="list-row group flex-col items-stretch gap-4 md:flex-row md:items-center">
      <Link
        href={`/pacientes/${task.patient?.id}`}
        className="flex min-w-0 flex-1 items-start gap-3"
      >
        <div
          className={clsx(
            'list-row-icon',
            task.isOverdue
              ? 'bg-status-red/15 text-status-red'
              : 'border border-status-yellow/60 bg-status-yellow/30 text-accent-text',
          )}
        >
          {task.isOverdue ? (
            <FiAlertTriangle className="h-5 w-5" />
          ) : (
            <FiClipboard className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink-primary group-hover:text-accent-text">
              {task.title}
            </span>
            <span className={`list-chip ${priorityBadgeClassName(task.priority)}`}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </span>
            <span className="list-chip bg-surface-muted text-ink-secondary">
              {TASK_TYPE_LABELS[task.type]}
            </span>
            <span className="list-chip bg-surface-muted text-ink-secondary">
              {TASK_STATUS_LABELS[task.status]}
            </span>
            {task.recurrenceRule && task.recurrenceRule !== 'NONE' && (
              <span className="list-chip bg-surface-muted text-ink-secondary">
                {TASK_RECURRENCE_LABELS[task.recurrenceRule]}
              </span>
            )}
            {task.isOverdue && (
              <span className="list-chip bg-status-red/15 text-status-red">Atrasado</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            <span>{task.patient?.nombre}</span>
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <FiCalendar className="h-3 w-3" />
                {formatDateOnly(task.dueDate)}
              </span>
            )}
            {task.details && <span className="truncate">{task.details}</span>}
          </div>
        </div>
        <FiChevronRight className="mt-1 h-5 w-5 text-ink-muted group-hover:text-accent-text" />
      </Link>

      <div className="flex flex-col gap-2 rounded-card border border-surface-muted/25 bg-surface-inset/40 p-3 md:w-72">
        <p className="text-xs font-medium text-ink-muted">Reprogramación rápida</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary flex-1 text-xs"
            onClick={() => handleQuickReschedule(1)}
            disabled={isPending}
          >
            Mañana
          </button>
          <button
            type="button"
            className="btn btn-secondary flex-1 text-xs"
            onClick={() => handleQuickReschedule(7)}
            disabled={isPending}
          >
            +7 días
          </button>
        </div>
        <div className="flex gap-2">
          <LocalizedDateInput
            id={`reschedule-${task.id}`}
            className="form-input"
            value={rescheduleDrafts[task.id] ?? extractDateOnly(task.dueDate) ?? ''}
            onChange={(value) => onRescheduleDraftChange(task.id, value)}
          />
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2 text-xs"
            onClick={handleSaveReschedule}
            disabled={isPending}
          >
            <FiSave className="h-3.5 w-3.5" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
