'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage, PaginatedResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiChevronLeft, FiChevronRight, FiFilter, FiShield, FiX } from 'react-icons/fi';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  action: string;
  diff: string | null;
  timestamp: string;
}

interface AdminUserRow {
  id: string;
  nombre: string;
  email: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: 'Creación', color: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'Actualización', color: 'bg-blue-100 text-blue-700' },
  DELETE: { label: 'Eliminación', color: 'bg-red-100 text-red-700' },
};

const ENTITY_LABELS: Record<string, string> = {
  Patient: 'Paciente',
  Encounter: 'Atención',
  EncounterSection: 'Sección',
  User: 'Usuario',
  ConditionCatalog: 'Catálogo',
  ConditionCatalogLocal: 'Catálogo local',
  Attachment: 'Adjunto',
};

export default function AuditoriaPage() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/pacientes');
    }
  }, [isAdmin, router]);

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data as AdminUserRow[];
    },
    enabled: isAdmin(),
  });

  const usersMap = new Map((users || []).map((u) => [u.id, u]));

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '30',
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
      const response = await api.get(`/audit?${params.toString()}`);
      return response.data as PaginatedResponse<AuditLogEntry>;
    },
    enabled: isAdmin(),
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  if (!isAdmin()) return null;

  const selectedLogDiff = (() => {
    if (!selectedLog?.diff) return null;
    try {
      return JSON.stringify(JSON.parse(selectedLog.diff), null, 2);
    } catch {
      return selectedLog.diff;
    }
  })();

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registro de auditoría</h1>
          <p className="text-slate-600">Historial de cambios en el sistema</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FiFilter className="w-4 h-4 text-primary-600" />
          <h2 className="font-semibold text-slate-900">Filtros operativos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="text-sm text-slate-600">Acción</label>
            <select
              className="form-input"
              value={filters.action}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, action: e.target.value }));
              }}
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_LABELS).map(([value, info]) => (
                <option key={value} value={value}>{info.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Entidad</label>
            <select
              className="form-input"
              value={filters.entityType}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, entityType: e.target.value }));
              }}
            >
              <option value="">Todas</option>
              {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Usuario</label>
            <select
              className="form-input"
              value={filters.userId}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, userId: e.target.value }));
              }}
            >
              <option value="">Todos</option>
              {(users || []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Desde</label>
            <input
              type="date"
              className="form-input"
              value={filters.dateFrom}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, dateFrom: e.target.value }));
              }}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Hasta</label>
            <input
              type="date"
              className="form-input"
              value={filters.dateTo}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, dateTo: e.target.value }));
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={getErrorMessage(error)} />
        </div>
      )}

      {/* Activity Summary (7.1) */}
      {logs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(['CREATE', 'UPDATE', 'DELETE'] as const).map((action) => {
            const count = logs.filter((l) => l.action === action).length;
            const info = ACTION_LABELS[action];
            return (
              <div key={action} className="card p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${info.color}`}>
                  <span className="text-lg font-bold">{count}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{info.label}</p>
                  <p className="text-xs text-slate-500">en esta página</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 skeleton rounded" />
            ))}
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-3 font-medium text-slate-600">Fecha</th>
                    <th className="pb-3 font-medium text-slate-600">Usuario</th>
                    <th className="pb-3 font-medium text-slate-600">Acción</th>
                    <th className="pb-3 font-medium text-slate-600">Entidad</th>
                    <th className="pb-3 font-medium text-slate-600">ID Entidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const user = usersMap.get(log.userId);
                    const actionInfo = ACTION_LABELS[log.action] || {
                      label: log.action,
                      color: 'bg-slate-100 text-slate-700',
                    };
                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 whitespace-nowrap text-slate-600">
                          {format(new Date(log.timestamp), "dd MMM yyyy HH:mm", { locale: es })}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-slate-900 font-medium">
                            {user?.nombre || 'Desconocido'}
                          </span>
                          {user?.email && (
                            <span className="block text-xs text-slate-400">{user.email}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-700">
                          {ENTITY_LABELS[log.entityType] || log.entityType}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono text-slate-500">
                            {log.entityId.slice(0, 8)}…
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            className="btn btn-secondary text-xs"
                            onClick={() => setSelectedLog(log)}
                          >
                            Ver diff
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200">
                <span className="text-sm text-slate-500">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-secondary flex items-center gap-1"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <button
                    className="btn btn-secondary flex items-center gap-1"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <FiShield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay registros de auditoría</p>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Detalle de auditoría</h2>
                <p className="text-sm text-slate-500">
                  {ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType} ·{' '}
                  {ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Usuario</p>
                <p className="text-sm text-slate-700">
                  {usersMap.get(selectedLog.userId)?.nombre || selectedLog.userId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Fecha</p>
                <p className="text-sm text-slate-700">
                  {format(new Date(selectedLog.timestamp), "dd MMM yyyy HH:mm:ss", { locale: es })}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Diff redactado</p>
                <pre className="mt-2 max-h-[24rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                  {selectedLogDiff || 'Sin diff disponible'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
