'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PatientTask, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/types';
import { FiAlertTriangle, FiCalendar, FiChevronRight, FiClipboard, FiSearch } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';

const STATUS_OPTIONS = ['', 'PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as const;
const TYPE_OPTIONS = ['', 'SEGUIMIENTO', 'EXAMEN', 'DERIVACION', 'TRAMITE'] as const;

export default function SeguimientosPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const queryKey = useMemo(() => ['task-inbox', search, status, type, overdueOnly], [search, status, type, overdueOnly]);

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
  });

  const tasks = data?.data || [];

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
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="form-input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por tarea o paciente"
            />
          </div>
          <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? TASK_STATUS_LABELS[value] : 'Todos los estados'}
              </option>
            ))}
          </select>
          <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value ? TASK_TYPE_LABELS[value] : 'Todos los tipos'}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={overdueOnly} onChange={() => setOverdueOnly((v) => !v)} />
            Solo atrasados
          </label>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">Error al cargar seguimientos.</div>
        ) : tasks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/pacientes/${task.patient?.id}`}
                className="group list-row"
              >
                <div
                  className={clsx(
                    'list-row-icon',
                    task.isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-primary-100 text-primary-600',
                  )}
                >
                  {task.isOverdue ? <FiAlertTriangle className="h-5 w-5" /> : <FiClipboard className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 group-hover:text-primary-600">{task.title}</span>
                    <span className="list-chip bg-slate-100 text-slate-600">
                      {TASK_TYPE_LABELS[task.type]}
                    </span>
                    <span className="list-chip bg-slate-100 text-slate-600">
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                    {task.isOverdue && (
                      <span className="list-chip bg-rose-100 text-rose-700">
                        Atrasado
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span>{task.patient?.nombre}</span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <FiCalendar className="h-3 w-3" />
                        {format(new Date(task.dueDate), "d MMM yyyy", { locale: es })}
                      </span>
                    )}
                    {task.details && <span className="truncate">{task.details}</span>}
                  </div>
                </div>
                <FiChevronRight className="h-5 w-5 text-slate-400 group-hover:text-primary-600" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiClipboard className="h-10 w-10 text-primary-400" />
            </div>
            <h3 className="empty-state-title">Sin seguimientos visibles</h3>
            <p className="empty-state-description">No hay seguimientos que coincidan con los filtros actuales.</p>
          </div>
        )}
      </div>
    </div>
  );
}
