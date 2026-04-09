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
  requestId?: string | null;
  action: string;
  reason?: string | null;
  result: string;
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
  UPDATE: { label: 'Actualización', color: 'border border-status-yellow/60 bg-status-yellow/30 text-accent-text' },
  DELETE: { label: 'Eliminación', color: 'bg-status-red/20 text-status-red' },
  EXPORT: { label: 'Exportación', color: 'bg-sky-100 text-sky-700' },
  DOWNLOAD: { label: 'Descarga', color: 'bg-amber-100 text-amber-700' },
  PASSWORD_CHANGED: { label: 'Cambio de contraseña', color: 'bg-orange-100 text-orange-700' },
  LOGIN: { label: 'Inicio de sesión', color: 'bg-emerald-100 text-emerald-700' },
  LOGOUT: { label: 'Cierre de sesión', color: 'bg-slate-200 text-slate-700' },
  LOGIN_FAILED: { label: 'Login fallido', color: 'bg-rose-100 text-rose-700' },
};

const ENTITY_LABELS: Record<string, string> = {
  Patient: 'Paciente',
  Encounter: 'Atención',
  EncounterSection: 'Sección',
  User: 'Usuario',
  ConditionCatalog: 'Catálogo',
  ConditionCatalogLocal: 'Catálogo local',
  Attachment: 'Adjunto',
  UserInvitation: 'Invitación',
  PatientExport: 'Exportación pacientes',
  Auth: 'Autenticación',
  Setting: 'Configuración',
};

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Exitoso', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rechazado', color: 'bg-amber-100 text-amber-700' },
  ERROR: { label: 'Error', color: 'bg-status-red/20 text-status-red' },
};

const REASON_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'Login',
  AUTH_LOGOUT: 'Logout',
  AUTH_LOGIN_REJECTED: 'Login rechazado',
  PATIENT_CREATED: 'Alta de paciente',
  PATIENT_UPDATED: 'Actualización de paciente',
  PATIENT_ADMIN_UPDATED: 'Actualización administrativa',
  PATIENT_HISTORY_UPDATED: 'Historial maestro',
  PATIENT_PROBLEM_CREATED: 'Alta de problema',
  PATIENT_PROBLEM_UPDATED: 'Actualización de problema',
  PATIENT_TASK_CREATED: 'Alta de seguimiento',
  PATIENT_TASK_UPDATED: 'Actualización de seguimiento',
  PATIENT_ARCHIVED: 'Archivo de paciente',
  PATIENT_RESTORED: 'Restauración de paciente',
  PATIENT_EXPORT_CSV: 'Exportación de pacientes',
  ENCOUNTER_CREATED: 'Creación de atención',
  ENCOUNTER_SECTION_UPDATED: 'Actualización de sección',
  ENCOUNTER_COMPLETED: 'Cierre de atención',
  ENCOUNTER_REOPENED: 'Reapertura de atención',
  ENCOUNTER_CANCELLED: 'Cancelación de atención',
  ENCOUNTER_REVIEW_STATUS_UPDATED: 'Cambio de revisión',
  ENCOUNTER_DOCUMENT_EXPORTED: 'Exportación documental',
  ATTACHMENT_UPLOADED: 'Carga de adjunto',
  ATTACHMENT_DOWNLOADED: 'Descarga de adjunto',
  ATTACHMENT_DELETED: 'Borrado de adjunto',
  USER_INVITATION_CREATED: 'Creación de invitación',
  USER_INVITATION_REVOKED: 'Revocación de invitación',
  USER_UPDATED: 'Actualización de usuario',
  USER_DEACTIVATED: 'Desactivación de usuario',
  USER_PROFILE_UPDATED: 'Actualización de perfil',
  USER_PASSWORD_CHANGED: 'Cambio de contraseña',
  USER_PASSWORD_RESET: 'Reset de contraseña',
  SETTINGS_UPDATED: 'Actualización de ajustes',
  AUDIT_UNSPECIFIED: 'Sin clasificar',
};

export default function AuditoriaPage() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
    reason: '',
    result: '',
    requestId: '',
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
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Auditoría</h1>
          <p className="page-header-description">Historial de cambios críticos y trazabilidad operativa del sistema.</p>
        </div>
      </div>

      <div className="filter-surface">
        <div className="flex items-center gap-2 mb-4">
          <FiFilter className="w-4 h-4 text-accent-text" />
          <h2 className="font-bold text-ink">Filtros operativos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
          <div>
            <label className="text-sm text-ink-secondary" htmlFor="audit-action-filter">Acción</label>
            <select
              id="audit-action-filter"
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
            <label className="text-sm text-ink-secondary" htmlFor="audit-entity-filter">Entidad</label>
            <select
              id="audit-entity-filter"
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
            <label className="text-sm text-ink-secondary" htmlFor="audit-user-filter">Usuario</label>
            <select
              id="audit-user-filter"
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
            <label className="text-sm text-ink-secondary" htmlFor="audit-reason-filter">Motivo</label>
            <select
              id="audit-reason-filter"
              className="form-input"
              value={filters.reason}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, reason: e.target.value }));
              }}
            >
              <option value="">Todos</option>
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-ink-secondary" htmlFor="audit-result-filter">Resultado</label>
            <select
              id="audit-result-filter"
              className="form-input"
              value={filters.result}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, result: e.target.value }));
              }}
            >
              <option value="">Todos</option>
              {Object.entries(RESULT_LABELS).map(([value, info]) => (
                <option key={value} value={value}>{info.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-ink-secondary" htmlFor="audit-date-from-filter">Desde</label>
            <input
              id="audit-date-from-filter"
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
            <label className="text-sm text-ink-secondary" htmlFor="audit-request-filter">Request ID</label>
            <input
              id="audit-request-filter"
              className="form-input"
              value={filters.requestId}
              onChange={(e) => {
                setPage(1);
                setFilters((current) => ({ ...current, requestId: e.target.value }));
              }}
              placeholder="Correlación"
            />
          </div>
          <div>
            <label className="text-sm text-ink-secondary" htmlFor="audit-date-to-filter">Hasta</label>
            <input
              id="audit-date-to-filter"
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
                  <tr className="border-b border-surface-muted/30 text-left">
                    <th className="pb-3 font-medium text-ink-secondary">Fecha</th>
                    <th className="pb-3 font-medium text-ink-secondary">Usuario</th>
                    <th className="pb-3 font-medium text-ink-secondary">Acción</th>
                    <th className="pb-3 font-medium text-ink-secondary">Motivo</th>
                    <th className="pb-3 font-medium text-ink-secondary">Resultado</th>
                    <th className="pb-3 font-medium text-ink-secondary">Entidad</th>
                    <th className="pb-3 font-medium text-ink-secondary">Request ID</th>
                    <th className="pb-3 font-medium text-ink-secondary">ID Entidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted/30">
                  {logs.map((log) => {
                    const user = usersMap.get(log.userId);
                    const actionInfo = ACTION_LABELS[log.action] || {
                      label: log.action,
                      color: 'bg-surface-muted text-ink-secondary',
                    };
                    return (
                      <tr key={log.id} className="hover:bg-surface-base/40">
                        <td className="py-3 pr-4 whitespace-nowrap text-ink-secondary">
                          {format(new Date(log.timestamp), "dd MMM yyyy HH:mm", { locale: es })}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-ink-primary font-medium">
                            {user?.nombre || 'Desconocido'}
                          </span>
                          {user?.email && (
                            <span className="block text-xs text-ink-muted">{user.email}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-ink-secondary">
                          {REASON_LABELS[log.reason || 'AUDIT_UNSPECIFIED'] || log.reason || 'Sin clasificar'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(RESULT_LABELS[log.result] || RESULT_LABELS.SUCCESS).color}`}>
                            {(RESULT_LABELS[log.result] || RESULT_LABELS.SUCCESS).label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-ink-secondary">
                          {ENTITY_LABELS[log.entityType] || log.entityType}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono text-ink-muted">
                            {log.requestId ? `${log.requestId.slice(0, 8)}…` : '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono text-ink-muted">
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
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-muted/30">
                <span className="text-sm text-ink-muted">
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
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiShield className="w-10 h-10 text-accent-text" />
            </div>
            <h3 className="empty-state-title">Sin registros de auditoría</h3>
            <p className="empty-state-description">No hay movimientos que coincidan con los filtros actuales.</p>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-primary/50" onClick={() => setSelectedLog(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-surface-muted/30 bg-surface-elevated shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-surface-muted/30 p-5">
              <div>
                <h2 className="text-lg font-bold text-ink">Detalle de auditoría</h2>
                <p className="text-sm text-ink-muted">
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
                <p className="text-xs uppercase tracking-wide text-ink-muted">Usuario</p>
                <p className="text-sm text-ink-secondary">
                  {usersMap.get(selectedLog.userId)?.nombre || selectedLog.userId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-muted">Fecha</p>
                <p className="text-sm text-ink-secondary">
                  {format(new Date(selectedLog.timestamp), "dd MMM yyyy HH:mm:ss", { locale: es })}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-ink-muted">Request ID</p>
                <p className="text-sm font-mono text-ink-secondary">
                  {selectedLog.requestId || 'No disponible'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-muted">Motivo</p>
                <p className="text-sm text-ink-secondary">
                  {REASON_LABELS[selectedLog.reason || 'AUDIT_UNSPECIFIED'] || selectedLog.reason || 'Sin clasificar'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-muted">Resultado</p>
                <p className="text-sm text-ink-secondary">
                  {(RESULT_LABELS[selectedLog.result] || RESULT_LABELS.SUCCESS).label}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-ink-muted">Diff redactado</p>
                <pre className="mt-2 max-h-[24rem] overflow-auto rounded-card border border-surface-muted/30 bg-surface-inset/40 p-4 text-xs text-ink-secondary">
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
