'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiCalendar, FiChevronRight, FiClipboard, FiPlus, FiUsers } from 'react-icons/fi';
import { formatDateOnly } from '@/lib/date';
import { STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import { sectionAnimation } from './dashboard.constants';
import type { DashboardData } from './dashboard.constants';
import type { ReminderCard } from './dashboard-clinical.helpers';

const PANEL_CLASS =
  'animate-fade-in overflow-hidden rounded-card border border-surface-muted/45 bg-surface-elevated shadow-soft';

interface ActiveEncountersPanelProps {
  isLoading: boolean;
  activeEncounters: DashboardData['activeEncounters'];
  canNewEncounter: boolean;
}

export function ActiveEncountersPanel({ isLoading, activeEncounters, canNewEncounter }: ActiveEncountersPanelProps) {
  return (
    <section className={PANEL_CLASS} style={sectionAnimation(40)}>
      <div className="flex items-center justify-between gap-4 border-b border-surface-muted/35 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Atenciones en curso</h2>
          <p className="mt-1 text-sm text-ink-secondary">Casos abiertos dentro del circuito activo.</p>
        </div>
        <Link
          href="/atenciones?status=EN_PROGRESO"
          className="text-sm font-bold text-ink-secondary transition-colors hover:text-ink"
        >
          Ver todas
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-5 py-5 sm:px-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-card skeleton" />
          ))}
        </div>
      ) : activeEncounters.length > 0 ? (
        <div className="divide-y divide-surface-muted/30">
          {activeEncounters.map((encounter, index) => {
            const pct =
              encounter.progress.total > 0
                ? (encounter.progress.completed / encounter.progress.total) * 100
                : 0;
            const progressText = `${encounter.progress.completed} de ${encounter.progress.total} secciones`;
            const statusLabel = STATUS_LABELS[encounter.status as keyof typeof STATUS_LABELS] ?? encounter.status;
            return (
              <Link
                key={encounter.id}
                href={`/atenciones/${encounter.id}`}
                className={clsx(
                  'group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-inset/50 sm:px-6 xl:grid-cols-[minmax(0,1fr)_max-content_240px_16px] xl:items-center',
                  index === 0 && 'bg-surface-inset/45',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-muted/45 bg-surface-elevated text-ink-secondary">
                    <FiUsers className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-ink">{encounter.patientName}</p>
                      <span className="rounded-pill border border-surface-muted/45 bg-surface-elevated px-2.5 py-0.5 text-xs font-bold text-ink-secondary">
                        {statusLabel}
                      </span>
                      {encounter.patientRut && (
                        <span className="text-sm text-ink-muted">{encounter.patientRut}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-secondary">
                      Actualizada {format(new Date(encounter.updatedAt), 'd MMM, HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
                <span className="inline-flex h-10 items-center justify-center rounded-card border border-frame-dark bg-frame-dark px-4 text-sm font-semibold text-white transition-colors group-hover:bg-ink">
                  Retomar atención
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink-secondary">Progreso</span>
                    <span className="font-semibold text-ink">{progressText}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted/45">
                    <div className="h-full rounded-full bg-clinical-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-ink-muted">Siguiente: Antecedentes</p>
                </div>
                <FiChevronRight className="hidden h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink xl:block" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-ink-secondary">No hay atenciones en progreso en este momento.</p>
          {canNewEncounter && (
            <Link
              href="/atenciones/nueva"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-card border border-frame-dark bg-frame-dark px-3.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
            >
              <FiPlus className="h-4 w-4" />
              Nueva atención
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

interface UpcomingTasksPanelProps {
  isLoading: boolean;
  upcomingTasks: DashboardData['upcomingTasks'];
}

export function UpcomingTasksPanel({ isLoading, upcomingTasks }: UpcomingTasksPanelProps) {
  return (
    <section className={PANEL_CLASS} style={sectionAnimation(80)}>
      <div className="flex items-center justify-between gap-4 border-b border-surface-muted/35 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Seguimientos próximos</h2>
          <p className="mt-1 text-sm text-ink-secondary">Tareas con fecha, prioridad y atraso visible.</p>
        </div>
        <Link
          href="/seguimientos"
          className="shrink-0 text-sm font-bold text-ink-secondary transition-colors hover:text-ink"
        >
          Abrir bandeja
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-5 py-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-card skeleton" />
          ))}
        </div>
      ) : upcomingTasks.length > 0 ? (
        <div className="divide-y divide-surface-muted/35">
          {upcomingTasks.map((task) => (
            <Link
              key={task.id}
              href={`/pacientes/${task.patient?.id ?? task.patientId}`}
              className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-inset/45"
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-surface-muted/40 bg-surface-inset text-ink-secondary">
                <FiClipboard className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-ink">{task.title}</p>
                  {task.isOverdue && (
                    <span className="rounded-pill bg-status-red/16 px-2.5 py-0.5 text-xs font-bold text-status-red-text">
                      Atrasado
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-secondary">
                  {task.patient?.nombre ?? 'Paciente sin nombre'} · {TASK_TYPE_LABELS[task.type]}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                  <span>{task.dueDate ? formatDateOnly(task.dueDate, 'd MMM') : 'Sin fecha'}</span>
                  <span>{task.priority.toLowerCase()}</span>
                </div>
              </div>
              <FiChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-muted/45 bg-surface-inset text-ink-secondary">
              <FiCalendar className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">No hay seguimientos próximos.</p>
              <p className="mt-1 text-sm leading-5 text-ink-secondary">
                Cuando agregues tareas con fecha, aparecerán aquí.
              </p>
              <Link
                href="/seguimientos"
                className="mt-3 inline-flex h-9 items-center justify-center rounded-card border border-surface-muted/60 bg-surface-elevated px-3.5 text-sm font-semibold text-ink-secondary transition-colors hover:border-frame/25 hover:text-ink"
              >
                Crear seguimiento
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface ReminderCardsPanelProps {
  isLoading: boolean;
  reminderCards: ReminderCard[];
}

export function ReminderCardsPanel({ isLoading, reminderCards }: ReminderCardsPanelProps) {
  return (
    <section className={PANEL_CLASS} style={sectionAnimation(120)}>
      <div className="flex items-center justify-between gap-4 border-b border-surface-muted/35 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Alertas operativas</h2>
          <p className="mt-1 text-sm text-ink-secondary">Atajos para seguimientos que requieren movimiento hoy.</p>
        </div>
        <Link
          href="/seguimientos"
          className="shrink-0 text-sm font-bold text-ink-secondary transition-colors hover:text-ink"
        >
          Ver bandeja
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 px-5 py-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-11 rounded-card skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
          {reminderCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={clsx(
                'flex items-center gap-2.5 rounded-card border px-3 py-2.5 text-sm transition-colors hover:bg-surface-inset',
                card.value > 0 ? card.tone : 'border-surface-muted/35 bg-surface-inset/45 text-ink',
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-surface-muted/40 bg-surface-elevated text-current">
                <card.icon className="h-4 w-4" />
              </div>
              <span className="min-w-0 flex-1 truncate font-semibold">{card.label}</span>
              <span className="text-base font-extrabold tracking-tight">{card.value}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
