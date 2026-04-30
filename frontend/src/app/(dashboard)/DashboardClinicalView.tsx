'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { FiCalendar, FiChevronRight, FiClipboard, FiClock, FiFolder } from 'react-icons/fi';
import { formatDateOnly } from '@/lib/date';
import { STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import { type DashboardData, sectionAnimation } from './dashboard.constants';
import DashboardClinicalHero from './DashboardClinicalHero';
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
    const map = new Map<
      string,
      {
        patientId: string;
        patientName: string;
        patientRut: string | null;
        updatedAt: string;
        latestEncounterId: string;
        latestEncounterStatus: string;
        encounterCount: number;
      }
    >();

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
              tone:
                data.counts.overdueTasks > 0
                  ? 'border-status-red/35 bg-status-red/8 text-status-red-text'
                  : 'border-surface-muted/30 bg-surface-elevated text-ink',
              icon: FiClock,
            },
            {
              label: 'Vencen hoy',
              value: data.counts.dueTodayTasks,
              href: '/pacientes?taskWindow=TODAY',
              tone:
                data.counts.dueTodayTasks > 0
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

  const panelClass =
    'animate-fade-in overflow-hidden rounded-[14px] border border-surface-muted/45 bg-surface-elevated shadow-soft';

  return (
    <div className="space-y-4 pb-2">
      <DashboardClinicalHero
        user={user}
        data={data}
        isLoading={isLoading}
        canNewEncounter={canNewEncounter}
        canNewPatient={canNewPatient}
        pendingEncounters={pendingEncounters}
        recentPatientsCount={recentPatients.length}
        upcomingTasks={upcomingTasks}
        totalForBreakdown={totalForBreakdown}
      />

      {showOverdueAlert && (
        <OverdueAlertSection
          overdueCount={overdueCount}
          overdueTasks={overdueTasks}
          onDismiss={onDismissOverdueAlert}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
        <section
          className={panelClass}
          style={sectionAnimation(40)}
        >
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
                <div key={i} className="h-16 rounded-[10px] skeleton" />
              ))}
            </div>
          ) : pendingEncounters.length > 0 ? (
            <div className="divide-y divide-surface-muted/35">
              {pendingEncounters.map((encounter) => {
                const pct =
                  encounter.progress.total > 0 ? (encounter.progress.completed / encounter.progress.total) * 100 : 0;
                return (
                  <Link
                    key={encounter.id}
                    href={`/atenciones/${encounter.id}`}
                    className="group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-inset/45 sm:px-6 lg:grid-cols-[minmax(0,1fr)_190px]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-surface-muted/40 bg-surface-inset text-ink-secondary">
                        <FiClock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-ink">{encounter.patientName}</p>
                          {encounter.patientRut && (
                            <span className="text-sm text-ink-muted">{encounter.patientRut}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-ink-secondary">
                          Actualizada {format(new Date(encounter.updatedAt), 'd MMM, HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 lg:justify-end">
                      <div className="min-w-0 flex-1 lg:max-w-[150px]">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-ink-secondary">Progreso</span>
                          <span className="font-medium text-ink">
                            {encounter.progress.completed}/{encounter.progress.total}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted/45">
                          <div className="h-full rounded-full bg-clinical-500" style={{ width: `${pct}%` }} />
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

        <div className="space-y-4">
          <section className={panelClass} style={sectionAnimation(80)}>
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
                  <div key={i} className="h-16 rounded-[10px] skeleton" />
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
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-surface-muted/40 bg-surface-inset text-ink-secondary">
                      <FiClipboard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-bold text-ink">{task.title}</p>
                        {task.isOverdue && (
                          <span className="rounded-[6px] bg-status-red/16 px-2 py-0.5 text-xs font-bold text-status-red-text">
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
              <div className="px-5 py-6">
                <p className="text-sm text-ink-secondary">No hay seguimientos próximos cargados en el tablero.</p>
              </div>
            )}
          </section>

          <section className={panelClass} style={sectionAnimation(120)}>
            <div className="flex items-center justify-between gap-4 border-b border-surface-muted/35 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink">Recordatorios operativos</h2>
                <p className="mt-1 text-sm text-ink-secondary">Atajos para seguimientos que requieren movimiento hoy.</p>
              </div>
              <Link href="/seguimientos" className="shrink-0 text-sm font-bold text-ink-secondary transition-colors hover:text-ink">
                Ver bandeja
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-2 px-5 py-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-11 rounded-[10px] skeleton" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-surface-muted/35">
                {reminderCards.map((card) => (
                  <Link
                    key={card.label}
                    href={card.href}
                    className={clsx(
                      'flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-inset/45',
                      card.value > 0 ? card.tone : 'text-ink',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-surface-muted/40 bg-surface-inset text-current">
                      <card.icon className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{card.label}</span>
                    <span className="text-lg font-extrabold tracking-tight">{card.value}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <RecentPatientsSection patients={recentPatients} isLoading={isLoading} />
        </div>

        <RecentActivitySection encounters={recentEncounters} isLoading={isLoading} />
      </div>
    </div>
  );
}
