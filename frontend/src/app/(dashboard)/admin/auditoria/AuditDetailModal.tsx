'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiX } from 'react-icons/fi';
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  REASON_LABELS,
  RESULT_LABELS,
  type AdminUserRow,
  type AuditLogEntry,
} from './auditoria.constants';

interface AuditDetailModalProps {
  log: AuditLogEntry;
  usersMap: Map<string, AdminUserRow>;
  onClose: () => void;
}

export default function AuditDetailModal({ log, usersMap, onClose }: AuditDetailModalProps) {
  const diffText = (() => {
    if (!log.diff) return null;
    try {
      return JSON.stringify(JSON.parse(log.diff), null, 2);
    } catch {
      return log.diff;
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl border border-surface-muted/30 bg-surface-elevated shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-surface-muted/30 p-5">
          <div>
            <h2 className="text-lg font-bold text-ink">Detalle de auditoría</h2>
            <p className="text-sm text-ink-muted">
              {ENTITY_LABELS[log.entityType] || log.entityType} ·{' '}
              {ACTION_LABELS[log.action]?.label || log.action}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            <FiX className="w-4 h-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Usuario</p>
            <p className="text-sm text-ink-secondary">
              {usersMap.get(log.userId)?.nombre || log.userId}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Fecha</p>
            <p className="text-sm text-ink-secondary">
              {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss', { locale: es })}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Request ID</p>
            <p className="text-sm font-mono text-ink-secondary">
              {log.requestId || 'No disponible'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Motivo</p>
            <p className="text-sm text-ink-secondary">
              {REASON_LABELS[log.reason || 'AUDIT_UNSPECIFIED'] || log.reason || 'Sin clasificar'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Resultado</p>
            <p className="text-sm text-ink-secondary">
              {(RESULT_LABELS[log.result] || RESULT_LABELS.SUCCESS).label}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Diff redactado</p>
            <pre className="mt-2 max-h-[24rem] overflow-auto rounded-card border border-surface-muted/30 bg-surface-inset/40 p-4 text-xs text-ink-secondary">
              {diffText || 'Sin diff disponible'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
