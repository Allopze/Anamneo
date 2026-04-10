'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PatientTask, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import { FiAlertTriangle, FiCalendar, FiChevronRight, FiClipboard, FiSearch } from 'react-icons/fi';
import clsx from 'clsx';
import { formatDateOnly } from '@/lib/date';
import { useAuthStore } from '@/stores/auth-store';

const STATUS_OPTIONS = ['', 'PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as const;
const TYPE_OPTIONS = ['', 'SEGUIMIENTO', 'EXAMEN', 'DERIVACION', 'TRAMITE'] as const;

export default function SeguimientosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const isOperationalAdmin = !!user?.isAdmin;

  // Initialise from URL search params so SmartHeaderBar chip links work
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdueOnly') === 'true');

  // Keep URL in sync when filters change
  const updateUrl = useCallback(
    (s: string, st: string, t: string, od: boolean) => {
      const params = new URLSearchParams();
      if (s.trim()) params.set('search', s.trim());
      if (st) params.set('status', st);
      if (t) params.set('type', t);
      if (od) params.set('overdueOnly', 'true');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );

  const queryKey = useMemo(() => ['task-inbox', search, status, type, overdueOnly], [search, status, type, overdueOnly]);

  useEffect(() => {
    if (!isOperationalAdmin) return;
    router.replace('/');
  }, [isOperationalAdmin, router]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (overdueOnly) params.set('overdueOnly', 'true');
      const response = await api.get(`/patients/tasks?${params.toString()}`);
      return response.data as { data: PatientTask[] };
    },
    enabled: !isOperationalAdmin,
  });

  const tasks = data?.data || [];

  if (isOperationalAdmin) {
    return null;
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              className="form-input pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateUrl(e.target.value, status, type, overdueOnly);
              }}
              placeholder="Buscar por tarea o paciente"
            />
          </div>
          <select className="form-input" value={status} onChange={(e) => {
            setStatus(e.target.value);
            updateUrl(search, e.target.value, type, overdueOnly);
          }}>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? TASK_STATUS_LABELS[value] : 'Todos los estados'}
              </option>
            ))}
          </select>
          <select className="form-input" value={type} onChange={(e) => {
            setType(e.target.value);
            updateUrl(search, status, e.target.value, overdueOnly);
          }}>
            {TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? TASK_TYPE_LABELS[value] : 'Todos los tipos'}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-card border border-surface-muted/30 px-3 py-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={overdueOnly} onChange={() => {
              const next = !overdueOnly;
              setOverdueOnly(next);
              updateUrl(search, status, type, next);
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
              <Link
                key={task.id}
                href={`/pacientes/${task.patient?.id}`}
                className="group list-row"
              >
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
                    <span className="list-chip bg-surface-muted text-ink-secondary">
                      {TASK_TYPE_LABELS[task.type]}
                    </span>
                    <span className="list-chip bg-surface-muted text-ink-secondary">
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
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
                <FiChevronRight className="h-5 w-5 text-ink-muted group-hover:text-accent-text" />
              </Link>
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
