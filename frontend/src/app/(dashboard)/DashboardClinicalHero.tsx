'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { FiChevronRight, FiClipboard, FiClock, FiFileText, FiPlus, FiUsers } from 'react-icons/fi';
import { getFirstName } from '@/lib/utils';
import { type DashboardData, getGreeting, sectionAnimation } from './dashboard.constants';

interface DashboardClinicalHeroProps {
  user: { nombre?: string } | null;
  data?: DashboardData;
  isLoading: boolean;
  canNewEncounter: boolean;
  canNewPatient: boolean;
  pendingEncounters: DashboardData['recent'];
  recentPatientsCount: number;
  upcomingTasks: DashboardData['upcomingTasks'];
  totalForBreakdown: number;
}

export default function DashboardClinicalHero({
  user,
  data,
  isLoading,
  canNewEncounter,
  canNewPatient,
  pendingEncounters,
  recentPatientsCount,
  upcomingTasks,
  totalForBreakdown,
}: DashboardClinicalHeroProps) {
  const quickActions = [
    canNewEncounter
      ? {
          href: '/atenciones/nueva',
          label: 'Nueva atención',
          icon: FiPlus,
        }
      : null,
    canNewPatient
      ? {
          href: '/pacientes/nuevo',
          label: 'Nuevo paciente',
          icon: FiUsers,
        }
      : null,
    {
      href: '/seguimientos',
      label: 'Bandeja de seguimientos',
      icon: FiClipboard,
    },
    {
      href: '/atenciones',
      label: 'Todas las atenciones',
      icon: FiFileText,
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const workflowBreakdown = data
    ? [
        { label: 'En progreso', value: data.counts.enProgreso, tone: 'bg-accent', textTone: 'text-ink' },
        {
          label: 'Completadas',
          value: data.counts.completado,
          tone: 'bg-status-green',
          textTone: 'text-status-green-text',
        },
        { label: 'Canceladas', value: data.counts.cancelado, tone: 'bg-surface-muted', textTone: 'text-ink-secondary' },
      ]
    : [];

  const nextPendingEncounter = pendingEncounters[0];
  const nextOverdueTask = upcomingTasks.find((task) => task.isOverdue);
  const nextTask = nextOverdueTask ?? upcomingTasks[0];
  const nextAction = nextPendingEncounter
    ? {
        href: `/atenciones/${nextPendingEncounter.id}`,
        title: 'Continuar atención en progreso',
        detail: `${nextPendingEncounter.patientName} · actualizada ${format(new Date(nextPendingEncounter.updatedAt), 'd MMM, HH:mm', { locale: es })}`,
        icon: FiClock,
      }
    : nextTask
      ? {
          href: `/pacientes/${nextTask.patient?.id ?? nextTask.patientId}`,
          title: nextTask.isOverdue ? 'Revisar seguimiento atrasado' : 'Revisar próximo seguimiento',
          detail: `${nextTask.title} · ${nextTask.patient?.nombre ?? 'Paciente sin nombre'}`,
          icon: FiClipboard,
        }
      : canNewEncounter
        ? {
            href: '/atenciones/nueva',
            title: 'Iniciar nueva atención',
            detail: 'No hay trabajo clínico urgente en la bandeja.',
            icon: FiPlus,
          }
        : {
            href: '/atenciones',
            title: 'Revisar historial de atenciones',
            detail: 'Consulta el movimiento reciente del equipo.',
            icon: FiFileText,
          };

  const todaySignals = data
    ? [
        { label: 'En curso', value: data.counts.enProgreso, href: '/atenciones?status=EN_PROGRESO' },
        { label: 'Para hoy', value: data.counts.dueTodayTasks, href: '/pacientes?taskWindow=TODAY' },
        { label: 'Atrasados', value: data.counts.overdueTasks, href: '/pacientes?taskWindow=OVERDUE' },
        { label: 'Pacientes recientes', value: recentPatientsCount, href: '/pacientes' },
      ]
    : [];

  return (
    <section
      className="animate-fade-in overflow-hidden rounded-card bg-surface-elevated shadow-soft"
      style={sectionAnimation(0)}
    >
      <div className="grid xl:grid-cols-[minmax(0,1.65fr)_380px]">
        <div className="px-6 py-7 lg:px-10 lg:py-8">
          <h1 className="text-[1.85rem] font-extrabold tracking-tight text-ink sm:text-[2.2rem]">
            {getGreeting()}, {getFirstName(user?.nombre)}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-secondary">
            Tablero clínico — carga activa, seguimientos y actividad reciente en un vistazo.
          </p>

          {isLoading ? (
            <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.85fr)]">
              <div className="h-28 rounded-2xl skeleton" />
              <div className="h-28 rounded-2xl skeleton" />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <Link
                href={nextAction.href}
                className="group flex min-h-[112px] items-start gap-4 rounded-2xl border border-surface-muted/45 bg-surface-inset/55 px-5 py-4 transition-colors hover:bg-surface-inset"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-ink-secondary">
                  <nextAction.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">Siguiente acción</p>
                  <p className="mt-2 text-lg font-extrabold tracking-tight text-ink">{nextAction.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-secondary">{nextAction.detail}</p>
                </div>
                <FiChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
              </Link>

              <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-surface-muted/45 bg-white">
                {todaySignals.map((signal) => (
                  <Link
                    key={signal.label}
                    href={signal.href}
                    className="min-h-[62px] border-surface-muted/35 px-4 py-3 transition-colors hover:bg-surface-inset/55 odd:border-r [&:nth-child(-n+2)]:border-b"
                  >
                    <p className="text-[0.8rem] font-medium text-ink-secondary">{signal.label}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{signal.value}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="border-t border-surface-muted/40 bg-surface-inset/40 px-6 py-5 lg:px-8 xl:border-l xl:border-t-0">
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-ink-secondary">Accesos rápidos</h2>
              <div className="mt-3 space-y-1">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-elevated"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-ink-secondary transition-colors group-hover:bg-accent/20 group-hover:text-accent-text">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 truncate text-sm font-bold text-ink">{action.label}</span>
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
                <h2 className="text-sm font-bold text-ink-secondary">Estado del flujo</h2>
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
                          style={{
                            width: `${Math.max((item.value / totalForBreakdown) * 100, item.value > 0 ? 6 : 0)}%`,
                          }}
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
  );
}
