'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import {
  FiActivity,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiFileText,
  FiPlus,
  FiSettings,
  FiUsers,
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/* ────────────────────────────────────────────────────────────── */
/*  Admin quick-access cards                                      */
/* ────────────────────────────────────────────────────────────── */

const ADMIN_CARDS = [
  {
    href: '/admin/usuarios',
    label: 'Gestión de usuarios',
    description: 'Invitar, editar roles y recuperar accesos.',
    icon: FiUsers,
  },
  {
    href: '/admin/auditoria',
    label: 'Auditoría',
    description: 'Revisar trazabilidad y exportes del sistema.',
    icon: FiActivity,
  },
  {
    href: '/pacientes',
    label: 'Padrón de pacientes',
    description: 'Consultar el registro administrativo y exportar CSV.',
    icon: FiClipboard,
  },
  {
    href: '/catalogo',
    label: 'Catálogo clínico',
    description: 'Mantener diagnósticos y sinónimos globales.',
    icon: FiFileText,
  },
  {
    href: '/ajustes',
    label: 'Ajustes del sistema',
    description: 'Configurar correo, plantillas e identidad del centro.',
    icon: FiSettings,
  },
];

/* ────────────────────────────────────────────────────────────── */
/*  Main component                                                */
/* ────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user, canCreateEncounter, canCreatePatient } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;
  const canNewEncounter = canCreateEncounter();
  const canNewPatient = canCreatePatient();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/dashboard');
      return res.data;
    },
    enabled: !isOperationalAdmin,
  });

  /* ── Admin View ──────────────────────────────────────────── */

  if (isOperationalAdmin) {
    return (
      <div className="space-y-6 pb-2">
        {/* Greeting */}
        <section
          className="animate-fade-in rounded-card bg-surface-elevated px-6 py-8 shadow-soft lg:px-10 lg:py-10"
          style={sectionAnimation(0)}
        >
          <h1 className="text-[2rem] font-extrabold tracking-tight text-ink sm:text-[2.4rem]">
            {getGreeting()}, {getFirstName(user?.nombre)}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-secondary">
            Panel operativo — gestiona usuarios, auditoría, catálogo y el registro administrativo de pacientes.
          </p>
        </section>

        {/* Quick-access grid */}
        <section
          className="animate-fade-in grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          style={sectionAnimation(60)}
        >
          {ADMIN_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-start gap-4 rounded-card bg-surface-elevated p-5 shadow-soft transition-all hover:bg-surface-inset/50 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-inset text-ink-secondary transition-colors group-hover:bg-accent/20 group-hover:text-accent-text">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-ink">{card.label}</h2>
                <p className="mt-1 text-sm text-ink-secondary">{card.description}</p>
              </div>
              <FiChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink" />
            </Link>
          ))}
        </section>
      </div>
    );
  }

  /* ── Clinical View — derived data ────────────────────────── */

  const pendingEncounters = data?.recent.filter((e) => e.status === 'EN_PROGRESO') ?? [];
  const recentEncounters = data?.recent ?? [];
  const upcomingTasks = data?.upcomingTasks ?? [];
  const totalForBreakdown = Math.max(data?.counts.total ?? 0, 1);

  const workflowBreakdown = data
    ? [
        { label: 'En progreso', value: data.counts.enProgreso, tone: 'bg-accent', textTone: 'text-ink' },
        { label: 'Completadas', value: data.counts.completado, tone: 'bg-status-green', textTone: 'text-status-green-text' },
        { label: 'Canceladas', value: data.counts.cancelado, tone: 'bg-surface-muted', textTone: 'text-ink-secondary' },
      ]
    : [];

  const quickActions = [
    canNewEncounter
      ? { href: '/atenciones/nueva', label: 'Nueva atención', description: 'Abrir una ficha clínica desde cero.', icon: FiPlus }
      : null,
    canNewPatient
      ? { href: '/pacientes/nuevo', label: 'Nuevo paciente', description: 'Registrar identidad y antecedentes básicos.', icon: FiUsers }
      : null,
    { href: '/seguimientos', label: 'Bandeja de seguimientos', description: 'Revisar tareas pendientes y próximas.', icon: FiClipboard },
    { href: '/atenciones', label: 'Todas las atenciones', description: 'Volver al historial completo del equipo.', icon: FiFileText },
  ].filter(Boolean) as Array<{ href: string; label: string; description: string; icon: typeof FiPlus }>;

  /* ── Clinical View — render ──────────────────────────────── */

  return (
    <div className="space-y-6 pb-2">
      {/* ── Hero: Greeting + CTAs + sidebar ───────────────── */}
      <section
        className="animate-fade-in overflow-hidden rounded-card bg-surface-elevated shadow-soft"
        style={sectionAnimation(0)}
      >
        <div className="grid xl:grid-cols-[minmax(0,1.8fr)_360px]">
          {/* Left column — greeting + CTA */}
          <div className="px-6 py-8 lg:px-10 lg:py-10">
            <h1 className="text-[2rem] font-extrabold tracking-tight text-ink sm:text-[2.4rem]">
              {getGreeting()}, {getFirstName(user?.nombre)}
            </h1>
            <p className="mt-2 max-w-2xl text-base text-ink-secondary">
              Tablero clínico — carga activa, seguimientos y actividad reciente en un vistazo.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {canNewEncounter && (
                <Link
                  href="/atenciones/nueva"
                  className="inline-flex items-center gap-2 rounded-full bg-frame px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-frame-dark"
                >
                  <FiPlus className="h-4 w-4" />
                  Nueva atención
                </Link>
              )}
              {canNewPatient && (
                <Link
                  href="/pacientes/nuevo"
                  className="inline-flex items-center gap-2 rounded-full border border-surface-muted bg-white px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-surface-inset"
                >
                  <FiUsers className="h-4 w-4" />
                  Nuevo paciente
                </Link>
              )}
            </div>
          </div>

          {/* Right column — quick actions + workflow breakdown */}
          <aside className="border-t border-surface-muted/40 bg-surface-inset/40 px-6 py-6 lg:px-8 xl:border-l xl:border-t-0">
            <div className="space-y-7">
              {/* Quick actions */}
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

              {/* Workflow breakdown */}
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
                          <span className={clsx('text-base font-bold tracking-tight', item.textTone)}>
                            {item.value}
                          </span>
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

      {/* ── Bottom grid: In-progress + Upcoming tasks ─────── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        {/* Atenciones en curso */}
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

        {/* Seguimientos próximos */}
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

        {/* Actividad reciente — full width */}
        <section
          className="animate-fade-in overflow-hidden rounded-card bg-surface-elevated shadow-soft xl:col-span-2"
          style={sectionAnimation(220)}
        >
          <div className="flex flex-col gap-3 border-b border-surface-muted/30 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">Actividad reciente</h2>
              <p className="mt-1 text-sm text-ink-secondary">Últimas atenciones registradas con estado y avance.</p>
            </div>
            <Link href="/atenciones" className="text-sm font-bold text-ink-secondary transition-colors hover:text-ink">
              Ir al historial
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5 sm:px-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl skeleton" />
              ))}
            </div>
          ) : recentEncounters.length > 0 ? (
            <div className="divide-y divide-surface-muted/30">
              {recentEncounters.map((encounter) => (
                <Link
                  key={encounter.id}
                  href={`/atenciones/${encounter.id}`}
                  className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-inset/40 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_180px_140px_32px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                          encounter.status === 'COMPLETADO'
                            ? 'bg-status-green/18 text-status-green-text'
                            : encounter.status === 'EN_PROGRESO'
                              ? 'bg-accent/20 text-accent-text'
                              : 'bg-surface-muted/30 text-ink-secondary'
                        )}
                      >
                        <FiFileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{encounter.patientName}</p>
                        <p className="mt-1 truncate text-sm text-ink-secondary">
                          {encounter.patientRut || 'Sin RUT'} · {encounter.createdByName}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-ink">{STATUS_LABELS[encounter.status]}</p>
                    <p className="mt-1 text-ink-secondary">{format(new Date(encounter.updatedAt), "d MMM, HH:mm", { locale: es })}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-ink">{encounter.progress.completed}/{encounter.progress.total}</p>
                    <p className="mt-1 text-ink-secondary">secciones</p>
                  </div>
                  <FiChevronRight className="hidden h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink lg:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 sm:px-6">
              <p className="text-sm text-ink-secondary">No hay atenciones recientes para mostrar.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
