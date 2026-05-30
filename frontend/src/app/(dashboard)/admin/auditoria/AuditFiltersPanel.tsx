'use client';

import type { Dispatch, SetStateAction } from 'react';
import { FiFilter } from 'react-icons/fi';
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  REASON_LABELS,
  RESULT_LABELS,
  type AdminUserRow,
} from './auditoria.constants';

export interface AuditFilters {
  action: string;
  entityType: string;
  userId: string;
  reason: string;
  result: string;
  requestId: string;
  dateFrom: string;
  dateTo: string;
}

interface AuditFiltersPanelProps {
  filters: AuditFilters;
  users: AdminUserRow[] | undefined;
  setPage: Dispatch<SetStateAction<number>>;
  setFilters: Dispatch<SetStateAction<AuditFilters>>;
}

export function AuditFiltersPanel({ filters, users, setPage, setFilters }: AuditFiltersPanelProps) {
  const update = (key: keyof AuditFilters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
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
            onChange={(e) => update('action', e.target.value)}
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
            onChange={(e) => update('entityType', e.target.value)}
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
            onChange={(e) => update('userId', e.target.value)}
          >
            <option value="">Todos</option>
            {(users || []).map((user) => (
              <option key={user.id} value={user.id}>{user.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-ink-secondary" htmlFor="audit-reason-filter">Motivo</label>
          <select
            id="audit-reason-filter"
            className="form-input"
            value={filters.reason}
            onChange={(e) => update('reason', e.target.value)}
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
            onChange={(e) => update('result', e.target.value)}
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
            onChange={(e) => update('dateFrom', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-ink-secondary" htmlFor="audit-request-filter">Request ID</label>
          <input
            id="audit-request-filter"
            className="form-input"
            value={filters.requestId}
            onChange={(e) => update('requestId', e.target.value)}
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
            onChange={(e) => update('dateTo', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
