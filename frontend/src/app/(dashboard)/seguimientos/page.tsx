'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PatientTask,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/types';
import { FiSearch } from 'react-icons/fi';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { useAuthUser } from '@/stores/auth-store';
import { invalidateDashboardOverviewQueries, invalidateTaskOverviewQueries } from '@/lib/query-invalidation';
import { notify } from '@/lib/notify';
import { TaskIcon } from '@/components/icons';
import { STATUS_OPTIONS, TYPE_OPTIONS, PRIORITY_OPTIONS } from './seguimientos.helpers';
import { SeguimientoTaskRow } from './SeguimientoTaskRow';

export default function SeguimientosPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthUser();
  const isOperationalAdmin = !!user?.isAdmin;

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [priority, setPriority] = useState(searchParams.get('priority') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdueOnly') === 'true');
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setStatus(searchParams.get('status') || '');
    setType(searchParams.get('type') || '');
    setPriority(searchParams.get('priority') || '');
    setOverdueOnly(searchParams.get('overdueOnly') === 'true');
  }, [searchParams]);

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
      notify.success('Seguimiento reprogramado');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: () => notify.error('No se pudo reprogramar el seguimiento'),
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
              onChange={(e) => { setSearch(e.target.value); updateUrl(e.target.value, status, type, priority, overdueOnly); }}
              placeholder="Buscar por tarea o paciente"
            />
          </div>
          <select className="form-input" aria-label="Filtrar por estado" value={status} onChange={(e) => { setStatus(e.target.value); updateUrl(search, e.target.value, type, priority, overdueOnly); }}>
            {STATUS_OPTIONS.map((v) => <option key={v} value={v}>{v ? TASK_STATUS_LABELS[v] : 'Todos los estados'}</option>)}
          </select>
          <select className="form-input" aria-label="Filtrar por tipo" value={type} onChange={(e) => { setType(e.target.value); updateUrl(search, status, e.target.value, priority, overdueOnly); }}>
            {TYPE_OPTIONS.map((v) => <option key={v} value={v}>{v ? TASK_TYPE_LABELS[v] : 'Todos los tipos'}</option>)}
          </select>
          <select className="form-input" aria-label="Filtrar por prioridad" value={priority} onChange={(e) => { setPriority(e.target.value); updateUrl(search, status, type, e.target.value, overdueOnly); }}>
            {PRIORITY_OPTIONS.map((v) => <option key={v} value={v}>{v ? TASK_PRIORITY_LABELS[v] : 'Todas las prioridades'}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-card border border-surface-muted/30 px-3 py-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={overdueOnly} onChange={() => { const next = !overdueOnly; setOverdueOnly(next); updateUrl(search, status, type, priority, next); }} />
            Solo atrasados
          </label>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-card skeleton" />)}
          </div>
        ) : error ? (
          <ErrorAlert title="No se pudieron cargar los seguimientos" message="Revisa tu conexión o intenta nuevamente." />
        ) : tasks.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {tasks.map((task) => (
              <SeguimientoTaskRow
                key={task.id}
                task={task}
                rescheduleDrafts={rescheduleDrafts}
                isPending={rescheduleMutation.isPending}
                onRescheduleDraftChange={(id, date) =>
                  setRescheduleDrafts((c) => ({ ...c, [id]: date }))
                }
                onReschedule={(id, date) => rescheduleMutation.mutate({ taskId: id, dueDate: date })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<TaskIcon className="h-6 w-6" aria-hidden="true" />}
            title="Sin seguimientos visibles"
            description="No hay tareas que coincidan con los filtros actuales. Ajusta estado, tipo o prioridad para revisar otros pendientes."
          />
        )}
      </div>
    </div>
  );
}
