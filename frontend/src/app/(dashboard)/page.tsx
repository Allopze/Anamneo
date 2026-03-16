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
    <div className="animate-fade-in">
      <div className="page-header mb-8">
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

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="metric-card"><div className="h-16 skeleton rounded" /></div>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-primary-100">
                <FiActivity className="w-5 h-5 text-primary-600" />
              </div>
              <span className="metric-value">{data.counts.total}</span>
            </div>
            <p className="metric-label">Total atenciones</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-amber-100">
                <FiClock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="metric-value">{data.counts.enProgreso}</span>
            </div>
            <p className="metric-label">En progreso</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-clinical-100">
                <FiCheckCircle className="w-5 h-5 text-clinical-600" />
              </div>
              <span className="metric-value">{data.counts.completado}</span>
            </div>
            <p className="metric-label">Completadas</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-slate-100">
                <FiXCircle className="w-5 h-5 text-slate-500" />
              </div>
              <span className="metric-value">{data.counts.cancelado}</span>
            </div>
            <p className="metric-label">Canceladas</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-primary-100">
                <FiClipboard className="w-5 h-5 text-primary-600" />
              </div>
              <span className="metric-value">{data.counts.upcomingTasks}</span>
            </div>
            <p className="metric-label">Seguimientos</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="metric-icon bg-rose-100">
                <FiAlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <span className="metric-value">{data.counts.pendingReview}</span>
            </div>
            <p className="metric-label">Pend. revisión</p>
          </div>
        </div>
      )}

      {data?.upcomingTasks?.length ? (
        <div className="card mb-8">
          <div className="panel-header">
            <h2 className="panel-title">Seguimientos próximos</h2>
            <Link href="/seguimientos" className="panel-link">
              Ver bandeja →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.upcomingTasks.map((task) => (
              <Link
                key={task.id}
                href={`/pacientes/${task.patient?.id}`}
                className="group list-row -mx-4"
              >
                <div className="list-row-icon bg-primary-100 text-primary-600">
                  <FiClipboard className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 group-hover:text-primary-600">{task.title}</div>
                  <div className="text-xs text-slate-500">
                    {task.patient?.nombre} · {TASK_TYPE_LABELS[task.type]}
                    {task.dueDate ? ` · ${format(new Date(task.dueDate), "d MMM", { locale: es })}` : ''}
                  </div>
                </div>
                {task.isOverdue && (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700">
                    Atrasado
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Pending (En Progreso) Panel */}
      {data && data.recent.filter((e) => e.status === 'EN_PROGRESO').length > 0 && (
        <div className="card mb-8">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="panel-title">Atenciones pendientes</h2>
            </div>
            <Link href="/atenciones?status=EN_PROGRESO" className="panel-link">
              Ver todas →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent.filter((e) => e.status === 'EN_PROGRESO').map((enc) => (
              <Link
                key={enc.id}
                href={`/atenciones/${enc.id}`}
                className="group list-row -mx-4"
              >
                <div className="list-row-icon bg-amber-100 text-amber-600">
                  <FiClock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-900 group-hover:text-primary-600">{enc.patientName}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 max-w-32 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${enc.progress.total > 0 ? (enc.progress.completed / enc.progress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{enc.progress.completed}/{enc.progress.total}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{format(new Date(enc.updatedAt), "d MMM HH:mm", { locale: es })}</span>
                <FiChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Encounters */}
      <div className="card">
        <div className="panel-header">
          <h2 className="panel-title">Últimas atenciones</h2>
          <Link href="/atenciones" className="panel-link">
            Ver todas →
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 skeleton rounded-lg" />
            ))}
          </div>
        ) : data?.recent && data.recent.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.recent.map((enc) => (
              <Link
                key={enc.id}
                href={`/atenciones/${enc.id}`}
                className="group list-row -mx-4"
              >
                <div className={clsx(
                  'list-row-icon',
                  enc.status === 'COMPLETADO' ? 'bg-clinical-100 text-clinical-600'
                    : enc.status === 'EN_PROGRESO' ? 'bg-amber-100 text-amber-600'
                    : 'bg-slate-100 text-slate-500',
                )}>
                  <FiFileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 truncate group-hover:text-primary-600">
                      {enc.patientName}
                    </span>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      enc.status === 'COMPLETADO' ? 'bg-clinical-100 text-clinical-700'
                        : enc.status === 'EN_PROGRESO' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700',
                    )}>
                      {STATUS_LABELS[enc.status]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>{format(new Date(enc.updatedAt), "d MMM, HH:mm", { locale: es })}</span>
                    <span>{enc.progress.completed}/{enc.progress.total} secciones</span>
                  </div>
                </div>
                <FiChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <FiFileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>No hay atenciones recientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
