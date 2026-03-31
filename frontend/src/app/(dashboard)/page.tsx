'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { PatientTask, STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import {
  FiFileText, FiUsers, FiActivity, FiCheckCircle,
  FiXCircle, FiClock, FiPlus, FiChevronRight, FiClipboard, FiAlertTriangle,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { getFirstName } from '@/lib/utils';
import { formatDateOnly } from '@/lib/date';

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

  return (
    <div className="animate-fade-in space-y-8">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Hola, {getFirstName(user?.nombre)}</h1>
          <p className="page-header-description">Resumen de actividad clínica y prioridades del día.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canNewEncounter && (
            <Link href="/atenciones/nueva" className="btn btn-primary flex items-center gap-2">
              <FiPlus className="w-4 h-4" />
              Nueva Atención
            </Link>
          )}
          {canNewPatient && (
            <Link href="/pacientes/nuevo" className="btn btn-secondary flex items-center gap-2">
              <FiUsers className="w-4 h-4" />
              Nuevo Paciente
            </Link>
          )}
        </div>
      </div>

      {/* ── Metric Strip ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="metric-card"><div className="h-16 skeleton" /></div>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-surface-base">
                <FiActivity className="w-5 h-5 text-ink-secondary" />
              </div>
              <span className="metric-value">{data.counts.total}</span>
            </div>
            <p className="metric-label">Total atenciones</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-status-yellow/20">
                <FiClock className="w-5 h-5 text-accent-text" />
              </div>
              <span className="metric-value">{data.counts.enProgreso}</span>
            </div>
            <p className="metric-label">En progreso</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-status-green/20">
                <FiCheckCircle className="w-5 h-5 text-status-green-text" />
              </div>
              <span className="metric-value">{data.counts.completado}</span>
            </div>
            <p className="metric-label">Completadas</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-surface-muted/30">
                <FiXCircle className="w-5 h-5 text-ink-muted" />
              </div>
              <span className="metric-value">{data.counts.cancelado}</span>
            </div>
            <p className="metric-label">Canceladas</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-accent/20">
                <FiClipboard className="w-5 h-5 text-accent-text" />
              </div>
              <span className="metric-value">{data.counts.upcomingTasks}</span>
            </div>
            <p className="metric-label">Seguimientos</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-status-red/20">
                <FiAlertTriangle className="w-5 h-5 text-status-red-text" />
              </div>
              <span className="metric-value">{data.counts.pendingReview}</span>
            </div>
            <p className="metric-label">Pend. revisión</p>
          </div>
        </div>
      )}

      {/* ── Upcoming Tasks ─────────────────────────────────────── */}
      {data?.upcomingTasks?.length ? (
        <div className="card">
          <div className="panel-header">
            <h2 className="panel-title">Seguimientos próximos</h2>
            <Link href="/seguimientos" className="panel-link">Ver bandeja →</Link>
          </div>
          <div className="space-y-1">
            {data.upcomingTasks.map((task) => (
              <Link key={task.id} href={`/pacientes/${task.patient?.id}`} className="group list-row">
                <div className="list-row-icon bg-accent/20 text-accent-text">
                  <FiClipboard className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink group-hover:text-ink-secondary">{task.title}</div>
                  <div className="text-micro text-ink-muted">
                    {task.patient?.nombre} · {TASK_TYPE_LABELS[task.type]}
                    {task.dueDate ? ` · ${formatDateOnly(task.dueDate, 'd MMM')}` : ''}
                  </div>
                </div>
                {task.isOverdue && (
                  <span className="list-chip bg-status-red/20 text-status-red-text">Atrasado</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Pending Encounters ─────────────────────────────────── */}
      {data && data.recent.filter((e) => e.status === 'EN_PROGRESO').length > 0 && (
        <div className="card">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
              <h2 className="panel-title">Atenciones pendientes</h2>
            </div>
            <Link href="/atenciones?status=EN_PROGRESO" className="panel-link">Ver todas →</Link>
          </div>
          <div className="space-y-1">
            {data.recent.filter((e) => e.status === 'EN_PROGRESO').map((enc) => (
              <Link key={enc.id} href={`/atenciones/${enc.id}`} className="group list-row">
                <div className="list-row-icon bg-status-yellow/20 text-accent-text">
                  <FiClock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-ink group-hover:text-ink-secondary">{enc.patientName}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 max-w-32 bg-surface-muted/40 rounded-pill h-1.5">
                      <div
                        className="bg-accent h-1.5 rounded-pill transition-all"
                        style={{ width: `${enc.progress.total > 0 ? (enc.progress.completed / enc.progress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-micro text-ink-muted">{enc.progress.completed}/{enc.progress.total}</span>
                  </div>
                </div>
                <span className="text-micro text-ink-muted">{format(new Date(enc.updatedAt), "d MMM HH:mm", { locale: es })}</span>
                <FiChevronRight className="w-4 h-4 text-ink-muted group-hover:text-ink" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Encounters ──────────────────────────────────── */}
      <div className="card">
        <div className="panel-header">
          <h2 className="panel-title">Últimas atenciones</h2>
          <Link href="/atenciones" className="panel-link">Ver todas →</Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 skeleton" />
            ))}
          </div>
        ) : data?.recent && data.recent.length > 0 ? (
          <div className="space-y-1">
            {data.recent.map((enc) => (
              <Link key={enc.id} href={`/atenciones/${enc.id}`} className="group list-row">
                <div className={clsx(
                  'list-row-icon',
                  enc.status === 'COMPLETADO' ? 'bg-status-green/20 text-status-green-text'
                    : enc.status === 'EN_PROGRESO' ? 'bg-status-yellow/20 text-accent-text'
                    : 'bg-surface-muted/30 text-ink-muted',
                )}>
                  <FiFileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink truncate group-hover:text-ink-secondary">
                      {enc.patientName}
                    </span>
                    <span className={clsx(
                      'list-chip',
                      enc.status === 'COMPLETADO' ? 'bg-status-green/20 text-status-green-text'
                        : enc.status === 'EN_PROGRESO' ? 'bg-status-yellow/20 text-accent-text'
                        : 'bg-surface-muted/30 text-ink-muted',
                    )}>
                      {STATUS_LABELS[enc.status]}
                    </span>
                  </div>
                  <div className="text-micro text-ink-muted flex items-center gap-3">
                    <span>{format(new Date(enc.updatedAt), "d MMM, HH:mm", { locale: es })}</span>
                    <span>{enc.progress.completed}/{enc.progress.total} secciones</span>
                  </div>
                </div>
                <FiChevronRight className="w-4 h-4 text-ink-muted group-hover:text-ink" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-ink-muted">
            <FiFileText className="w-10 h-10 mx-auto mb-3 text-surface-muted" />
            <p>No hay atenciones recientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
