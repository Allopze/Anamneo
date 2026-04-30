'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { FiClipboard, FiFileText, FiPlus, FiUsers } from 'react-icons/fi';
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
    <section className="animate-fade-in space-y-3" style={sectionAnimation(0)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            {getGreeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
          {quickActions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={clsx(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-pill border px-3.5 text-sm font-semibold transition-colors',
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
        <div className="grid gap-2 rounded-card border border-surface-muted/55 bg-surface-elevated p-3 shadow-soft sm:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-14 rounded-card skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid overflow-hidden rounded-card border border-surface-muted/55 bg-surface-elevated shadow-soft sm:grid-cols-4">
          {todaySignals.map((signal) => (
            <Link
              key={signal.label}
              href={signal.href}
              className="border-surface-muted/35 px-4 py-3 transition-colors hover:bg-surface-inset/55 max-sm:border-b sm:border-r sm:last:border-r-0"
            >
              <p className="text-xs font-medium leading-4 text-ink-secondary">{signal.label}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{signal.value}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
