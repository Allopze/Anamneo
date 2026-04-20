'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PatientTask,
  TASK_PRIORITY_LABELS,
  TASK_RECURRENCE_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/types';
import { FiAlertTriangle, FiCalendar, FiChevronRight, FiClipboard, FiSave, FiSearch } from 'react-icons/fi';
import clsx from 'clsx';
import { extractDateOnly, formatDateOnly } from '@/lib/date';
import { useAuthStore } from '@/stores/auth-store';
import { invalidateDashboardOverviewQueries, invalidateTaskOverviewQueries } from '@/lib/query-invalidation';
import toast from 'react-hot-toast';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';

const STATUS_OPTIONS = ['', 'PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as const;
const TYPE_OPTIONS = ['', 'SEGUIMIENTO', 'EXAMEN', 'DERIVACION', 'TRAMITE'] as const;
const PRIORITY_OPTIONS = ['', 'ALTA', 'MEDIA', 'BAJA'] as const;

function addDaysToDateOnly(days: number) {
  return extractDateOnly(new Date(Date.now() + days * 24 * 60 * 60 * 1000)) || '';
}

function priorityBadgeClassName(priority: PatientTask['priority']) {
  if (priority === 'ALTA') return 'bg-status-red/15 text-status-red';
  if (priority === 'MEDIA') return 'bg-status-yellow/30 text-accent-text';
  return 'bg-surface-muted text-ink-secondary';
}

export default function SeguimientosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;

  // Initialise from URL search params so SmartHeaderBar chip links work
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [priority, setPriority] = useState(searchParams.get('priority') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdueOnly') === 'true');
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, string>>({});

  // Keep local state in sync when searchParams change (e.g. KPI chip navigation)
  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setStatus(searchParams.get('status') || '');
    setType(searchParams.get('type') || '');
    setPriority(searchParams.get('priority') || '');
    setOverdueOnly(searchParams.get('overdueOnly') === 'true');
  }, [searchParams]);

  // Keep URL in sync when filters change
  const updateUrl = useCallback(
    (s: string, st: string, t: string, pr: string, od: boolean) => {
      const params = new URLSearchParams();
      if (s.trim()) params.set('search', s.trim());
      if (st) params.set('status', st);
      if (t) params.set('type', t);
      if (pr) params.set('priority', pr);
      if (od) params.set('overdueOnly', 'true');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );

  const queryKey = useMemo(
    () => ['task-inbox', search, status, type, priority, overdueOnly],
    [search, status, type, priority, overdueOnly],
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (priority) params.set('priority', priority);
      if (overdueOnly) params.set('overdueOnly', 'true');
      const response = await api.get(`/patients/tasks?${params.toString()}`);
      return response.data as { data: PatientTask[] };
    },
    enabled: !isOperationalAdmin,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ taskId, dueDate }: { taskId: string; dueDate: string }) =>
      api.put(`/patients/tasks/${taskId}`, { dueDate }),
    onSuccess: async () => {
      toast.success('Seguimiento reprogramado');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: () => {
      toast.error('No se pudo reprogramar el seguimiento');
    },
  });

  const tasks = data?.data || [];

  if (isOperationalAdmin) {
    return (
      <RouteAccessGate
        when={true}
        title="Redirigiendo…"
        description="Esta bandeja clínica no está disponible para perfiles administrativos. Te llevamos al inicio."
        href="/"
        actionLabel="Ir al inicio"
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Seguimientos</h1>
          <p className="page-header-description">Bandeja clínica de tareas pendientes y próximas acciones.</p>
        </div>
      </div>

      <div className="filter-surface">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              className="form-input pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateUrl(e.target.value, status, type, priority, overdueOnly);
              }}
              placeholder="Buscar por tarea o paciente"
            />
          </div>
          <select className="form-input" value={status} onChange={(e) => {
            setStatus(e.target.value);
            updateUrl(search, e.target.value, type, priority, overdueOnly);
          }}>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? TASK_STATUS_LABELS[value] : 'Todos los estados'}
              </option>
            ))}
          </select>
          <select className="form-input" value={type} onChange={(e) => {
            setType(e.target.value);
            updateUrl(search, status, e.target.value, priority, overdueOnly);
          }}>
            {TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? TASK_TYPE_LABELS[value] : 'Todos los tipos'}
              </option>
            ))}
          </select>
          <select className="form-input" value={priority} onChange={(e) => {
            setPriority(e.target.value);
            updateUrl(search, status, type, e.target.value, overdueOnly);
          }}>
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? TASK_PRIORITY_LABELS[value] : 'Todas las prioridades'}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-card border border-surface-muted/30 px-3 py-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={overdueOnly} onChange={() => {
              const next = !overdueOnly;
              setOverdueOnly(next);
              updateUrl(search, status, type, priority, next);
            }} />
            Solo atrasados
          </label>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-card skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-status-red">Error al cargar seguimientos.</div>
        ) : tasks.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {tasks.map((task) => (
              <div key={task.id} className="list-row group flex-col items-stretch gap-4 md:flex-row md:items-center">
                <Link href={`/pacientes/${task.patient?.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className={clsx(
                      'list-row-icon',
                      task.isOverdue ? 'bg-status-red/15 text-status-red' : 'border border-status-yellow/60 bg-status-yellow/30 text-accent-text',
                    )}
                  >
                    {task.isOverdue ? <FiAlertTriangle className="h-5 w-5" /> : <FiClipboard className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-primary group-hover:text-accent-text">{task.title}</span>
                      <span className={`list-chip ${priorityBadgeClassName(task.priority)}`}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </span>
                      <span className="list-chip bg-surface-muted text-ink-secondary">
                        {TASK_TYPE_LABELS[task.type]}
                      </span>
                      <span className="list-chip bg-surface-muted text-ink-secondary">
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                      {task.recurrenceRule && task.recurrenceRule !== 'NONE' && (
                        <span className="list-chip bg-surface-muted text-ink-secondary">
                          {TASK_RECURRENCE_LABELS[task.recurrenceRule]}
                        </span>
                      )}
                      {task.isOverdue && (
                        <span className="list-chip bg-status-red/15 text-status-red">
                          Atrasado
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
                      <span>{task.patient?.nombre}</span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <FiCalendar className="h-3 w-3" />
                          {formatDateOnly(task.dueDate)}
                        </span>
                      )}
                      {task.details && <span className="truncate">{task.details}</span>}
                    </div>
                  </div>
                  <FiChevronRight className="mt-1 h-5 w-5 text-ink-muted group-hover:text-accent-text" />
                </Link>

                <div className="flex flex-col gap-2 rounded-card border border-surface-muted/25 bg-surface-inset/40 p-3 md:w-72">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">Reprogramación rápida</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 text-xs"
                      onClick={() => {
                        const nextDate = addDaysToDateOnly(1);
                        setRescheduleDrafts((current) => ({ ...current, [task.id]: nextDate }));
                        rescheduleMutation.mutate({ taskId: task.id, dueDate: nextDate });
                      }}
                      disabled={rescheduleMutation.isPending}
                    >
                      Mañana
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 text-xs"
                      onClick={() => {
                        const nextDate = addDaysToDateOnly(7);
                        setRescheduleDrafts((current) => ({ ...current, [task.id]: nextDate }));
                        rescheduleMutation.mutate({ taskId: task.id, dueDate: nextDate });
                      }}
                      disabled={rescheduleMutation.isPending}
                    >
                      +7 días
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="form-input"
                      value={rescheduleDrafts[task.id] ?? extractDateOnly(task.dueDate) ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setRescheduleDrafts((current) => ({ ...current, [task.id]: value }));
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary flex items-center gap-2 text-xs"
                      onClick={() => {
                        const selectedDate = rescheduleDrafts[task.id] ?? extractDateOnly(task.dueDate) ?? '';
                        if (!selectedDate) {
                          toast.error('Debe elegir una fecha');
                          return;
                        }
                        rescheduleMutation.mutate({ taskId: task.id, dueDate: selectedDate });
                      }}
                      disabled={rescheduleMutation.isPending}
                    >
                      <FiSave className="h-3.5 w-3.5" />
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiClipboard className="h-10 w-10 text-accent-text" />
            </div>
            <h3 className="empty-state-title">Sin seguimientos visibles</h3>
            <p className="empty-state-description">No hay seguimientos que coincidan con los filtros actuales.</p>
          </div>
        )}
      </div>
    </div>
  );
}
