'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiFileText,
  FiPlus,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { getFirstName } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { PatientTask, STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';

interface DashboardData {
  counts: {
    enProgreso: number;
    completado: number;
    cancelado: number;
    total: number;
    pendingReview: number;
    upcomingTasks: number;
  };
  recent: Array<{
    id: string;
    patientId: string;
    patientName: string;
    patientRut: string | null;
    createdByName: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    progress: { completed: number; total: number };
  }>;
  upcomingTasks: PatientTask[];
}

const sectionAnimation = (delay: number) => ({
  animationDelay: `${delay}ms`,
  animationFillMode: 'both' as const,
});

export default function DashboardPage() {
  const { user, canCreateEncounter, canCreatePatient } = useAuthStore();
  const canNewEncounter = canCreateEncounter();
  const canNewPatient = canCreatePatient();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/dashboard');
      return res.data;
    },
  });

  const pendingEncounters = data?.recent.filter((encounter) => encounter.status === 'EN_PROGRESO') ?? [];
  const recentEncounters = data?.recent ?? [];
  const upcomingTasks = data?.upcomingTasks ?? [];
  const totalForBreakdown = Math.max(data?.counts.total ?? 0, 1);

  const workflowBreakdown = data
    ? [
        {
          label: 'En progreso',
          value: data.counts.enProgreso,
          tone: 'bg-accent',
          textTone: 'text-ink',
        },
        {
          label: 'Completadas',
          value: data.counts.completado,
          tone: 'bg-status-green',
          textTone: 'text-status-green-text',
        },
        {
          label: 'Canceladas',
          value: data.counts.cancelado,
          tone: 'bg-surface-muted',
          textTone: 'text-ink-secondary',
        },
      ]
    : [];

  const summaryRows = data
    ? [
        {
          label: 'Pendientes de revisión',
          value: data.counts.pendingReview,
          description: 'Atenciones listas para validación clínica.',
          icon: FiAlertTriangle,
          tone: 'text-status-red-text',
          background: 'bg-status-red/14',
        },
        {
          label: 'Seguimientos activos',
          value: data.counts.upcomingTasks,
          description: 'Tareas próximas o atrasadas en pacientes.',
          icon: FiClipboard,
          tone: 'text-accent-text',
          background: 'bg-accent/24',
        },
        {
          label: 'Completadas hoy',
          value: data.counts.completado,
          description: 'Atenciones cerradas dentro del tablero actual.',
          icon: FiCheckCircle,
          tone: 'text-status-green-text',
          background: 'bg-status-green/18',
        },
        {
          label: 'Canceladas',
          value: data.counts.cancelado,
          description: 'Registros cerrados sin continuidad clínica.',
          icon: FiXCircle,
          tone: 'text-ink-secondary',
          background: 'bg-surface-muted/30',
        },
      ]
    : [];

  const quickActions = [
    canNewEncounter
      ? {
          href: '/atenciones/nueva',
          label: 'Nueva atención',
          description: 'Abrir una ficha clínica desde cero.',
          icon: FiPlus,
        }
      : null,
    canNewPatient
      ? {
          href: '/pacientes/nuevo',
          label: 'Nuevo paciente',
          description: 'Registrar identidad y antecedentes básicos.',
          icon: FiUsers,
        }
      : null,
    {
      href: '/seguimientos',
      label: 'Bandeja de seguimientos',
      description: 'Revisar tareas pendientes y próximas.',
      icon: FiClipboard,
    },
    {
      href: '/atenciones',
      label: 'Todas las atenciones',
      description: 'Volver al historial completo del equipo.',
      icon: FiFileText,
    },
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    description: string;
    icon: typeof FiPlus;
  }>;

  return (
    <div className="space-y-6 pb-2">
      <section
        className="animate-fade-in overflow-hidden rounded-[28px] border border-frame/10 bg-surface-elevated shadow-soft"
        style={sectionAnimation(0)}
      >
        <div className="grid xl:grid-cols-[minmax(0,1.8fr)_360px]">
          <div className="px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="flex flex-col gap-5 border-b border-surface-muted/50 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h1 className="text-[2rem] font-semibold tracking-tight text-ink sm:text-[2.4rem]">
                  Inicio
                </h1>
                <p className="mt-2 text-base text-ink-secondary">
                  {getFirstName(user?.nombre)}, este tablero concentra carga activa, revisión clínica y próximos seguimientos.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {canNewEncounter ? (
                  <Link
                    href="/atenciones/nueva"
                    className="inline-flex items-center gap-2 rounded-xl bg-frame px-4 py-2.5 text-sm font-medium text-ink-onDark transition-colors hover:bg-frame-dark"
                  >
                    <FiPlus className="h-4 w-4" />
                    Nueva atención
                  </Link>
                ) : null}

                {canNewPatient ? (
                  <Link
                    href="/pacientes/nuevo"
                    className="inline-flex items-center gap-2 rounded-xl border border-surface-muted bg-surface-base px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted/25"
                  >
                    <FiUsers className="h-4 w-4" />
                    Nuevo paciente
                  </Link>
                ) : null}
              </div>
            </div>

            {isLoading ? (
              <DashboardHeroSkeleton />
            ) : data ? (
              <div className="grid gap-4 pt-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-[24px] bg-frame px-5 py-5 text-ink-onDark sm:px-6 sm:py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-ink-onDark/62">Atenciones activas</p>
                      <div className="mt-3 flex items-end gap-3">
                        <span className="text-[3.4rem] font-semibold leading-none">
                          {data.counts.enProgreso}
                        </span>
                        <span className="pb-1 text-sm text-ink-onDark/62">
                          en curso
                        </span>
                      </div>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8">
                      <FiClock className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-ink-onDark/62">Total abiertas</p>
                      <p className="mt-1 text-lg font-medium text-ink-onDark">
                        {data.counts.total} registradas
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-ink-onDark/62">Último movimiento</p>
                      <p className="mt-1 text-lg font-medium text-ink-onDark">
                        {recentEncounters[0]
                          ? format(new Date(recentEncounters[0].updatedAt), "d MMM, HH:mm", { locale: es })
                          : 'Sin actividad reciente'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-surface-muted/45 bg-surface-base/48">
                  <div className="divide-y divide-surface-muted/40">
                    {summaryRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-start gap-4 px-4 py-4 sm:px-5"
                      >
                        <div
                          className={clsx(
                            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            row.background,
                            row.tone
                          )}
                        >
                          <row.icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-sm font-medium text-ink">{row.label}</p>
                            <span className="text-2xl font-semibold tracking-tight text-ink">
                              {row.value}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-ink-secondary">{row.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="border-t border-surface-muted/50 bg-surface-base/48 px-5 py-5 sm:px-6 lg:px-8 xl:border-l xl:border-t-0">
            <div className="space-y-7 xl:sticky xl:top-24">
              <section>
                <h2 className="text-lg font-semibold tracking-tight text-ink">Acciones</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Crear, retomar y revisar sin salir del flujo principal.
                </p>

                <div className="mt-4 overflow-hidden rounded-[22px] border border-surface-muted/45 bg-surface-elevated">
                  {quickActions.map((action, index) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={clsx(
                        'group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-base/65',
                        index > 0 && 'border-t border-surface-muted/35'
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-base text-ink-secondary transition-colors group-hover:text-ink">
                        <action.icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{action.label}</p>
                        <p className="mt-1 text-sm text-ink-secondary">{action.description}</p>
                      </div>
                      <FiChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
                    </Link>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold tracking-tight text-ink">Estado del flujo</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Distribución actual de atenciones dentro del tablero.
                </p>

                {isLoading ? (
                  <div className="mt-4 space-y-3">
                    {[...Array(3)].map((_, index) => (
                      <div key={index} className="h-14 rounded-2xl skeleton" />
                    ))}
                  </div>
                ) : data ? (
                  <div className="mt-4 space-y-4">
                    {workflowBreakdown.map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={clsx('h-2.5 w-2.5 rounded-full', item.tone)} />
                            <span className="text-sm font-medium text-ink">{item.label}</span>
                          </div>
                          <span className={clsx('text-lg font-semibold tracking-tight', item.textTone)}>
                            {item.value}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted/45">
                          <div
                            className={clsx('h-full rounded-full', item.tone)}
                            style={{ width: `${Math.max((item.value / totalForBreakdown) * 100, item.value > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <section
          className="animate-fade-in overflow-hidden rounded-[28px] border border-frame/10 bg-surface-elevated shadow-soft"
          style={sectionAnimation(80)}
        >
          <div className="flex items-center justify-between gap-4 border-b border-surface-muted/45 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Atenciones en curso</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Casos abiertos que siguen dentro del circuito activo.
              </p>
            </div>
            <Link
              href="/atenciones?status=EN_PROGRESO"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
            >
              Ver todas
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5 sm:px-6">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-20 rounded-2xl skeleton" />
              ))}
            </div>
          ) : pendingEncounters.length > 0 ? (
            <div className="divide-y divide-surface-muted/35">
              {pendingEncounters.map((encounter) => {
                const progressWidth = encounter.progress.total > 0
                  ? (encounter.progress.completed / encounter.progress.total) * 100
                  : 0;

                return (
                  <Link
                    key={encounter.id}
                    href={`/atenciones/${encounter.id}`}
                    className="group grid gap-4 px-5 py-4 transition-colors hover:bg-surface-base/45 sm:px-6 lg:grid-cols-[minmax(0,1fr)_200px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/24 text-accent-text">
                          <FiClock className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-ink">{encounter.patientName}</p>
                            {encounter.patientRut ? (
                              <span className="text-sm text-ink-muted">{encounter.patientRut}</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-ink-secondary">
                            Actualizada {format(new Date(encounter.updatedAt), "d MMM, HH:mm", { locale: es })}
                          </p>
                        </div>
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
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${progressWidth}%` }}
                          />
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
              <p className="text-sm text-ink-secondary">
                No hay atenciones en progreso en este momento.
              </p>
            </div>
          )}
        </section>

        <section
          className="animate-fade-in overflow-hidden rounded-[28px] border border-frame/10 bg-surface-elevated shadow-soft"
          style={sectionAnimation(140)}
        >
          <div className="flex items-center justify-between gap-4 border-b border-surface-muted/45 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Seguimientos próximos</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Tareas con fecha, prioridad y atraso visible.
              </p>
            </div>
            <Link
              href="/seguimientos"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
            >
              Abrir bandeja
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5 sm:px-6">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-20 rounded-2xl skeleton" />
              ))}
            </div>
          ) : upcomingTasks.length > 0 ? (
            <div className="divide-y divide-surface-muted/35">
              {upcomingTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/pacientes/${task.patient?.id ?? task.patientId}`}
                  className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-base/45 sm:px-6"
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-base text-ink-secondary">
                    <FiClipboard className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                      {task.isOverdue ? (
                        <span className="rounded-md bg-status-red/16 px-2 py-1 text-xs font-medium text-status-red-text">
                          Atrasado
                        </span>
                      ) : null}
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
              <p className="text-sm text-ink-secondary">
                No hay seguimientos próximos cargados en el tablero.
              </p>
            </div>
          )}
        </section>

        <section
          className="animate-fade-in overflow-hidden rounded-[28px] border border-frame/10 bg-surface-elevated shadow-soft xl:col-span-2"
          style={sectionAnimation(220)}
        >
          <div className="flex flex-col gap-3 border-b border-surface-muted/45 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Actividad reciente</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Últimas atenciones registradas con estado y avance.
              </p>
            </div>
            <Link
              href="/atenciones"
              className="text-sm font-medium text-ink-secondary transition-colors hover:text-ink"
            >
              Ir al historial
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5 sm:px-6">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="h-16 rounded-2xl skeleton" />
              ))}
            </div>
          ) : recentEncounters.length > 0 ? (
            <div className="divide-y divide-surface-muted/35">
              {recentEncounters.map((encounter) => (
                <Link
                  key={encounter.id}
                  href={`/atenciones/${encounter.id}`}
                  className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-base/45 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_180px_140px_32px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          encounter.status === 'COMPLETADO'
                            ? 'bg-status-green/18 text-status-green-text'
                            : encounter.status === 'EN_PROGRESO'
                              ? 'bg-accent/24 text-accent-text'
                              : 'bg-surface-muted/35 text-ink-secondary'
                        )}
                      >
                        <FiFileText className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{encounter.patientName}</p>
                        <p className="mt-1 truncate text-sm text-ink-secondary">
                          {encounter.patientRut || 'Sin RUT'} · {encounter.createdByName}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="font-medium text-ink">{STATUS_LABELS[encounter.status]}</p>
                    <p className="mt-1 text-ink-secondary">
                      {format(new Date(encounter.updatedAt), "d MMM, HH:mm", { locale: es })}
                    </p>
                  </div>

                  <div className="text-sm">
                    <p className="font-medium text-ink">
                      {encounter.progress.completed}/{encounter.progress.total}
                    </p>
                    <p className="mt-1 text-ink-secondary">secciones</p>
                  </div>

                  <FiChevronRight className="hidden h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink lg:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 sm:px-6">
              <p className="text-sm text-ink-secondary">
                No hay atenciones recientes para mostrar.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardHeroSkeleton() {
  return (
    <div className="grid gap-4 pt-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="h-[210px] rounded-[24px] skeleton" />
      <div className="h-[210px] rounded-[24px] skeleton" />
    </div>
  );
}
