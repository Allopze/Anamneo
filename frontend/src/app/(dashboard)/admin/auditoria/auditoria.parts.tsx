'use client';

import { FiChevronLeft, FiChevronRight, FiShield } from 'react-icons/fi';
import { EmptyState } from '@/components/common/EmptyState';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  REASON_LABELS,
  RESULT_LABELS,
  type AdminUserRow,
  type AuditLogEntry,
} from './auditoria.constants';

export { AuditFiltersPanel } from './AuditFiltersPanel';

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  isLoading: boolean;
  usersMap: Map<string, AdminUserRow>;
  page: number;
  pagination: { page: number; totalPages: number; total: number } | undefined;
  onSelectLog: (log: AuditLogEntry) => void;
  onPageChange: (delta: number) => void;
}

export function AuditLogTable({
  logs,
  isLoading,
  usersMap,
  page,
  pagination,
  onSelectLog,
  onPageChange,
}: AuditLogTableProps) {
  return (
    <div className="card">
      {logs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(['CREATE', 'UPDATE', 'DELETE'] as const).map((action) => {
            const count = logs.filter((l) => l.action === action).length;
            const info = ACTION_LABELS[action];
            return (
              <div key={action} className="metric-card flex items-center gap-3">
                <div className={`metric-icon ${info.color}`}>
                  <span className="text-lg font-bold">{count}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-primary">{info.label}</p>
                  <p className="text-xs text-ink-muted">en esta página</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 skeleton rounded" />
          ))}
        </div>
      ) : logs.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-surface-muted/25" role="region" aria-label="Registros de auditoría con desplazamiento horizontal">
            <table className="min-w-[1120px] w-full text-sm">
              <thead>
                <tr className="border-b border-surface-muted/30 bg-surface-inset text-left">
                  <th className="px-3 py-3 font-medium text-ink-secondary">Fecha</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">Usuario</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">Acción</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">Motivo</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">Resultado</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">Entidad</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">Request ID</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">ID Entidad</th>
                  <th className="px-3 py-3 font-medium text-ink-secondary">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted/30">
                {logs.map((log) => {
                  const logUser = usersMap.get(log.userId);
                  const actionInfo = ACTION_LABELS[log.action] || {
                    label: log.action,
                    color: 'bg-surface-muted text-ink-secondary',
                  };
                  return (
                    <tr key={log.id} className="hover:bg-surface-base/40">
                      <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">
                        {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm', { locale: es })}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-ink-primary font-medium">
                          {logUser?.nombre || 'Desconocido'}
                        </span>
                        {logUser?.email && (
                          <span className="block text-xs text-ink-muted">{logUser.email}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-secondary">
                        {REASON_LABELS[log.reason || 'AUDIT_UNSPECIFIED'] || log.reason || 'Sin clasificar'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${(RESULT_LABELS[log.result] || RESULT_LABELS.SUCCESS).color}`}
                        >
                          {(RESULT_LABELS[log.result] || RESULT_LABELS.SUCCESS).label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-secondary">
                        {ENTITY_LABELS[log.entityType] || log.entityType}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono text-ink-muted">
                          {log.requestId ? `${log.requestId.slice(0, 8)}…` : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono text-ink-muted">
                          {log.entityId.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          className="btn btn-secondary text-xs"
                          onClick={() => onSelectLog(log)}
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

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-muted/30">
              <span className="text-sm text-ink-muted">
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-secondary flex items-center gap-1"
                  disabled={page <= 1}
                  onClick={() => onPageChange(-1)}
                >
                  <FiChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  className="btn btn-secondary flex items-center gap-1"
                  disabled={page >= pagination.totalPages}
                  onClick={() => onPageChange(1)}
                >
                  Siguiente
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<FiShield className="h-6 w-6" aria-hidden="true" />}
          title="Sin registros de auditoría"
          description="No hay movimientos que coincidan con los filtros actuales."
        />
      )}
    </div>
  );
}
