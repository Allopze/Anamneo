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
  const firstName = getFirstName(user?.nombre);

  return (
    <section className="animate-fade-in space-y-4" style={sectionAnimation(0)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[1.9rem]">
            {getGreeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-secondary">
            Tablero clínico — carga activa, seguimientos y actividad reciente en un vistazo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:grid lg:w-[560px] lg:grid-cols-2">
          {quickActions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={clsx(
                'inline-flex h-10 items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold transition-colors lg:w-full',
                index === 0
                  ? 'border-frame-dark bg-frame-dark text-white hover:bg-ink'
                  : 'border-surface-muted/60 bg-surface-elevated text-ink-secondary hover:border-frame/25 hover:text-ink',
              )}
            >
              <action.icon className="h-4 w-4" />
              <span className="truncate">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.75fr)]">
          <div className="h-32 rounded-[14px] skeleton" />
          <div className="h-32 rounded-[14px] skeleton" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.75fr)]">
          <Link
            href={nextAction.href}
            className="group flex min-h-[132px] items-start gap-4 rounded-[14px] border border-surface-muted/55 bg-surface-elevated px-5 py-4 shadow-soft transition-colors hover:bg-surface-inset/55"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-surface-muted/45 bg-surface-inset text-ink-secondary">
              <nextAction.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Siguiente acción</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-ink">{nextAction.title}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-secondary">{nextAction.detail}</p>
            </div>
            <FiChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
          </Link>

          <div className="overflow-hidden rounded-[14px] border border-surface-muted/55 bg-surface-elevated shadow-soft">
            <div className="grid grid-cols-2 border-b border-surface-muted/35 sm:grid-cols-4">
              {todaySignals.map((signal) => (
                <Link
                  key={signal.label}
                  href={signal.href}
                  className="border-surface-muted/35 px-3 py-3 transition-colors hover:bg-surface-inset/55 odd:border-r [&:nth-child(-n+2)]:border-b sm:border-b-0 sm:border-r sm:last:border-r-0"
                >
                  <p className="truncate text-xs font-medium text-ink-secondary">{signal.label}</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{signal.value}</p>
                </Link>
              ))}
            </div>

            {data ? (
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
                {workflowBreakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium text-ink-secondary">{item.label}</span>
                      <span className={clsx('text-sm font-bold', item.textTone)}>{item.value}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted/45">
                      <div
                        className={clsx('h-full rounded-full', item.tone === 'bg-accent' ? 'bg-clinical-500' : item.tone)}
                        style={{
                          width: `${Math.max((item.value / totalForBreakdown) * 100, item.value > 0 ? 6 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
