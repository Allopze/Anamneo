'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import {
  FiCalendar,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiFileText,
  FiFolder,
  FiPlus,
  FiUsers,
} from 'react-icons/fi';
import { formatDateOnly } from '@/lib/date';
import { getFirstName } from '@/lib/utils';
import { STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import {
  type DashboardData,
  getGreeting,
  sectionAnimation,
} from './dashboard.constants';
import OverdueAlertSection from './OverdueAlertSection';
import RecentActivitySection from './RecentActivitySection';
import RecentPatientsSection from './RecentPatientsSection';

interface DashboardClinicalViewProps {
  user: { nombre?: string } | null;
  data?: DashboardData;
  isLoading: boolean;
  canNewEncounter: boolean;
  canNewPatient: boolean;
  showOverdueAlert: boolean;
  overdueCount: number;
  overdueTasks: DashboardData['upcomingTasks'];
  onDismissOverdueAlert: () => void;
}

export default function DashboardClinicalView({
  user,
  data,
  isLoading,
  canNewEncounter,
  canNewPatient,
  showOverdueAlert,
  overdueCount,
  overdueTasks,
  onDismissOverdueAlert,
}: DashboardClinicalViewProps) {
  const recentEncounters = useMemo(() => data?.recent ?? [], [data?.recent]);

  const pendingEncounters = useMemo(
    () => recentEncounters.filter((e) => e.status === 'EN_PROGRESO'),
    [recentEncounters],
  );

  const patientMap = useMemo(() => {
    const map = new Map<string, {
      patientId: string;
      patientName: string;
      patientRut: string | null;
      updatedAt: string;
      latestEncounterId: string;
      latestEncounterStatus: string;
      encounterCount: number;
    }>();

    for (const encounter of recentEncounters) {
      const existing = map.get(encounter.patientId);
      if (existing) {
        existing.encounterCount += 1;
        continue;
      }

      map.set(encounter.patientId, {
        patientId: encounter.patientId,
        patientName: encounter.patientName,
        patientRut: encounter.patientRut,
        updatedAt: encounter.updatedAt,
        latestEncounterId: encounter.id,
        latestEncounterStatus: STATUS_LABELS[encounter.status as keyof typeof STATUS_LABELS] ?? encounter.status,
        encounterCount: 1,
      });
    }

    return map;
  }, [recentEncounters]);

  const recentPatients = Array.from(patientMap.values()).slice(0, 5);
  const upcomingTasks = data?.upcomingTasks ?? [];
  const totalForBreakdown = Math.max(data?.counts.total ?? 0, 1);

  const reminderCards = useMemo(
    () =>
      data
        ? [
            {
              label: 'Vencidos',
              value: data.counts.overdueTasks,
              href: '/pacientes?taskWindow=OVERDUE',
              tone: data.counts.overdueTasks > 0
                ? 'border-status-red/35 bg-status-red/8 text-status-red-text'
                : 'border-surface-muted/30 bg-surface-elevated text-ink',
              icon: FiClock,
            },
            {
              label: 'Vencen hoy',
              value: data.counts.dueTodayTasks,
              href: '/pacientes?taskWindow=TODAY',
              tone: data.counts.dueTodayTasks > 0
                ? 'border-status-yellow/45 bg-status-yellow/16 text-accent-text'
                : 'border-surface-muted/30 bg-surface-elevated text-ink',
              icon: FiClipboard,
            },
            {
              label: 'Esta semana',
              value: data.counts.dueThisWeekTasks,
              href: '/pacientes?taskWindow=THIS_WEEK',
              tone: 'border-surface-muted/30 bg-surface-elevated text-ink',
              icon: FiCalendar,
            },
            {
              label: 'Trámites próximos',
              value: data.counts.upcomingAdministrativeTasks,
              href: '/seguimientos?type=TRAMITE',
              tone: 'border-surface-muted/30 bg-surface-elevated text-ink',
              icon: FiFolder,
            },
          ]
        : [],
    [data],
  );

  const quickActions = useMemo(
    () =>
      [
        canNewEncounter
          ? { href: '/atenciones/nueva', label: 'Nueva atención', description: 'Abrir una ficha clínica desde cero.', icon: FiPlus }
          : null,
        canNewPatient
          ? { href: '/pacientes/nuevo', label: 'Nuevo paciente', description: 'Registrar identidad y antecedentes básicos.', icon: FiUsers }
          : null,
        { href: '/seguimientos', label: 'Bandeja de seguimientos', description: 'Revisar tareas pendientes y próximas.', icon: FiClipboard },
        { href: '/atenciones', label: 'Todas las atenciones', description: 'Volver al historial completo del equipo.', icon: FiFileText },
      ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [canNewEncounter, canNewPatient],
  );

  const workflowBreakdown = data
    ? [
        { label: 'En progreso', value: data.counts.enProgreso, tone: 'bg-accent', textTone: 'text-ink' },
        { label: 'Completadas', value: data.counts.completado, tone: 'bg-status-green', textTone: 'text-status-green-text' },
        { label: 'Canceladas', value: data.counts.cancelado, tone: 'bg-surface-muted', textTone: 'text-ink-secondary' },
      ]
    : [];

  return (
    <div className="space-y-6 pb-2">
      <section
        className="animate-fade-in overflow-hidden rounded-card bg-surface-elevated shadow-soft"
        style={sectionAnimation(0)}
      >
        <div className="grid xl:grid-cols-[minmax(0,1.8fr)_360px]">
          <div className="px-6 py-8 lg:px-10 lg:py-10">
            <h1 className="text-[2rem] font-extrabold tracking-tight text-ink sm:text-[2.4rem]">
              {getGreeting()}, {getFirstName(user?.nombre)}
            </h1>
            <p className="mt-2 max-w-2xl text-base text-ink-secondary">
              Tablero clínico — carga activa, seguimientos y actividad reciente en un vistazo.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={"inline-flex items-center gap-2 rounded-full border border-surface-muted bg-white px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-surface-inset"}
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <aside className="border-t border-surface-muted/40 bg-surface-inset/40 px-6 py-6 lg:px-8 xl:border-l xl:border-t-0">
            <div className="space-y-7">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Accesos rápidos</h2>
                <div className="mt-3 space-y-1">
                  {quickActions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="group flex items-center gap-3 rounded-full px-3 py-2.5 transition-colors hover:bg-surface-elevated"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-ink-secondary transition-colors group-hover:bg-accent/20 group-hover:text-accent-text">
                        <action.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-ink">{action.label}</span>
                      <FiChevronRight className="ml-auto h-3.5 w-3.5 text-ink-muted transition-colors group-hover:text-ink" />
                    </Link>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-10 rounded-full skeleton" />
                  ))}
                </div>
              ) : data ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Estado del flujo</h2>
                  <div className="mt-3 space-y-3">
                    {workflowBreakdown.map((item) => (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={clsx('h-2 w-2 rounded-full', item.tone)} />
                            <span className="text-sm font-medium text-ink">{item.label}</span>
                          </div>
                          <span className={clsx('text-base font-bold tracking-tight', item.textTone)}>{item.value}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted/40">
                          <div
                            className={clsx('h-full rounded-full', item.tone)}
                            style={{ width: `${Math.max((item.value / totalForBreakdown) * 100, item.value > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      {showOverdueAlert && (
        <OverdueAlertSection overdueCount={overdueCount} overdueTasks={overdueTasks} onDismiss={onDismissOverdueAlert} />
      )}

      <section
        className="animate-fade-in rounded-card bg-surface-elevated px-5 py-5 shadow-soft sm:px-6"
        style={sectionAnimation(40)}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink">Recordatorios operativos</h2>
            <p className="mt-1 text-sm text-ink-secondary">Atajos para seguimientos que requieren movimiento hoy.</p>
          </div>
          <Link href="/seguimientos" className="text-sm font-bold text-ink-secondary transition-colors hover:text-ink">
            Ver bandeja
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-24 rounded-2xl skeleton" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reminderCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className={clsx('rounded-2xl border px-4 py-4 transition-colors hover:bg-surface-inset/35', card.tone)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{card.label}</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight">{card.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-current">
                    <card.icon className="h-[18px] w-[18px]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <section
          className="animate-fade-in overflow-hidden rounded-card bg-surface-elevated shadow-soft"
          style={sectionAnimation(80)}
        >
          <div className="flex items-center justify-between gap-4 border-b border-surface-muted/30 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">Atenciones en curso</h2>
              <p className="mt-1 text-sm text-ink-secondary">Casos abiertos dentro del circuito activo.</p>
            </div>
            <Link href="/atenciones?status=EN_PROGRESO" className="text-sm font-bold text-ink-secondary transition-colors hover:text-ink">
              Ver todas
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5 sm:px-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-2xl skeleton" />
              ))}
            </div>
          ) : pendingEncounters.length > 0 ? (
            <div className="divide-y divide-surface-muted/30">
              {pendingEncounters.map((encounter) => {
                const pct = encounter.progress.total > 0
                  ? (encounter.progress.completed / encounter.progress.total) * 100
                  : 0;
                return (
                  <Link
                    key={encounter.id}
                    href={`/atenciones/${encounter.id}`}
                    className="group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-inset/40 sm:px-6 lg:grid-cols-[minmax(0,1fr)_200px]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent-text">
                        <FiClock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-ink">{encounter.patientName}</p>
                          {encounter.patientRut && <span className="text-sm text-ink-muted">{encounter.patientRut}</span>}
                        </div>
                        <p className="mt-1 text-sm text-ink-secondary">
                          Actualizada {format(new Date(encounter.updatedAt), "d MMM, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 lg:justify-end">
                      <div className="min-w-0 flex-1 lg:max-w-[150px]">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-ink-secondary">Progreso</span>
                          <span className="font-medium text-ink">{encounter.progress.completed}/{encounter.progress.total}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted/40">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <FiChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-8 sm:px-6">
              <p className="text-sm text-ink-secondary">No hay atenciones en progreso en este momento.</p>
            </div>
          )}
        </section>

        <section
          className="animate-fade-in overflow-hidden rounded-card bg-surface-elevated shadow-soft"
          style={sectionAnimation(140)}
        >
          <div className="flex items-center justify-between gap-4 border-b border-surface-muted/30 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">Seguimientos próximos</h2>
              <p className="mt-1 text-sm text-ink-secondary">Tareas con fecha, prioridad y atraso visible.</p>
            </div>
            <Link href="/seguimientos" className="text-sm font-bold text-ink-secondary transition-colors hover:text-ink">
              Abrir bandeja
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5 sm:px-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-2xl skeleton" />
              ))}
            </div>
          ) : upcomingTasks.length > 0 ? (
            <div className="divide-y divide-surface-muted/30">
              {upcomingTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/pacientes/${task.patient?.id ?? task.patientId}`}
                  className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-inset/40 sm:px-6"
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-inset text-ink-secondary">
                    <FiClipboard className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-ink">{task.title}</p>
                      {task.isOverdue && (
                        <span className="rounded-full bg-status-red/16 px-2.5 py-0.5 text-xs font-bold text-status-red-text">
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
            <div className="px-5 py-8 sm:px-6">
              <p className="text-sm text-ink-secondary">No hay seguimientos próximos cargados en el tablero.</p>
            </div>
          )}
        </section>

        <RecentPatientsSection patients={recentPatients} isLoading={isLoading} />
        <RecentActivitySection encounters={recentEncounters} isLoading={isLoading} />
      </div>
    </div>
  );
}
