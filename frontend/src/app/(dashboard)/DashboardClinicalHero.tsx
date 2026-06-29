'use client';

import Link from 'next/link';
import { FiActivity, FiAlertTriangle, FiCalendar, FiChevronRight, FiClipboard, FiPlus, FiUsers } from 'react-icons/fi';
import { FichaIcon } from '@/components/icons';
import { getFirstName } from '@/lib/utils';
import { type DashboardData, getGreeting, sectionAnimation } from './dashboard.constants';

interface DashboardClinicalHeroProps {
  user: { nombre?: string } | null;
  data?: DashboardData;
  isLoading: boolean;
  canNewEncounter: boolean;
  canNewPatient: boolean;
  recentPatientsCount: number;
}

export default function DashboardClinicalHero({
  user,
  data,
  isLoading,
  canNewEncounter,
  canNewPatient,
  recentPatientsCount,
}: DashboardClinicalHeroProps) {
  const primaryAction = canNewEncounter
    ? {
        href: '/atenciones/nueva',
        label: 'Nueva atención',
        icon: FiPlus,
      }
    : canNewPatient
      ? {
          href: '/pacientes/nuevo',
          label: 'Nuevo paciente',
          icon: FiUsers,
        }
      : null;

  const secondaryActions = [
    canNewPatient && primaryAction?.href !== '/pacientes/nuevo'
      ? {
          href: '/pacientes/nuevo',
          label: 'Nuevo paciente',
          icon: FiUsers,
        }
      : null,
    {
      href: '/seguimientos',
      label: 'Seguimientos',
      icon: FiClipboard,
    },
    {
      href: '/atenciones',
      label: 'Atenciones',
      icon: FichaIcon,
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const todaySignals = data
    ? [
        { label: 'En curso', value: data.counts.enProgreso, href: '/atenciones?status=EN_PROGRESO', icon: FiActivity },
        { label: 'Para hoy', value: data.counts.dueTodayTasks, href: '/pacientes?taskWindow=TODAY', icon: FiCalendar },
        { label: 'Atrasados', value: data.counts.overdueTasks, href: '/pacientes?taskWindow=OVERDUE', icon: FiAlertTriangle },
        { label: 'Pacientes recientes', value: recentPatientsCount, href: '/pacientes', icon: FiUsers },
      ]
    : [];
  const firstName = getFirstName(user?.nombre);

  return (
    <section className="animate-fade-in space-y-3" style={sectionAnimation(0)}>
      <div className="grid gap-3 xl:grid-cols-[minmax(18rem,1fr)_auto] xl:items-start">
        <div className="min-w-0 text-left">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            {getGreeting()}
            {firstName ? `, ${firstName}.` : ''}
          </h1>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-start xl:justify-end">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="inline-flex h-11 min-w-[13.5rem] items-center justify-center gap-2 rounded-btn border border-frame-dark bg-frame-dark px-5 text-sm font-semibold text-white transition-[background-color,border-color,color,transform] hover:bg-ink active:scale-[0.98] sm:w-auto"
            >
              <primaryAction.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{primaryAction.label}</span>
            </Link>
          )}

          <div className="flex min-w-0 flex-wrap gap-1 rounded-btn border border-surface-muted/45 bg-surface-elevated/75 p-1 shadow-soft">
            {secondaryActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-input px-3 text-sm font-semibold text-ink-secondary transition-[background-color,color,transform] hover:bg-surface-inset hover:text-ink active:scale-[0.98] sm:flex-none"
              >
                <action.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-2 rounded-card border border-surface-muted/55 bg-surface-elevated p-3 shadow-soft sm:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-14 rounded-card skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {todaySignals.map((signal) => (
            <Link
              key={signal.label}
              href={signal.href}
              className="group flex min-h-[84px] items-center gap-3 rounded-card border border-surface-muted/50 bg-surface-elevated px-4 py-3 shadow-soft transition-[background-color,border-color,box-shadow] hover:border-frame/15 hover:bg-surface-inset/55 hover:shadow-card"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-surface-muted/45 bg-surface-inset text-ink-secondary">
                <signal.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium leading-4 text-ink-secondary">{signal.label}</span>
                <span className="mt-1 block text-2xl font-extrabold tracking-tight text-ink">{signal.value}</span>
              </span>
              <FiChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
