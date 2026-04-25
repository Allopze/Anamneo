'use client';

import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';

type AuditIntegrityResponse = {
  valid: boolean;
  checked: number;
  total: number;
  brokenAt?: string;
  warning?: string;
};

export default function AuditIntegrityCard() {
  const integrityQuery = useQuery({
    queryKey: ['audit-integrity'],
    queryFn: async () => (await api.get('/audit/integrity/verify?full=true')).data as AuditIntegrityResponse,
    staleTime: 60_000,
  });

  if (integrityQuery.isLoading) {
    return <div className="h-32 skeleton rounded-card" aria-hidden="true" />;
  }

  if (integrityQuery.isError || !integrityQuery.data) {
    return (
      <div className="rounded-card border border-status-red/30 bg-status-red/10 p-4 text-sm text-status-red-text">
        <p className="font-semibold text-ink-primary">Integridad de auditoría</p>
        <p className="mt-2">No se pudo verificar la cadena ahora mismo: {getErrorMessage(integrityQuery.error)}</p>
        <button type="button" className="btn btn-secondary mt-3" onClick={() => void integrityQuery.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  const { valid, checked, total, brokenAt, warning } = integrityQuery.data;

  return (
    <div className="rounded-card border border-surface-muted/40 bg-surface-elevated p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Integridad de auditoría</p>
          <h2 className="mt-2 text-lg font-bold text-ink-primary">
            {valid ? 'Cadena íntegra' : 'Cadena con quiebre detectado'}
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Verificación operativa del hash chain sobre los registros auditables más recientes.
          </p>
        </div>

        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${valid ? 'bg-status-green/20 text-status-green-text' : 'bg-status-red/15 text-status-red-text'}`}>
          {valid ? 'Íntegra' : 'Atención requerida'}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-muted/30 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Entradas verificadas</p>
          <p className="mt-2 text-2xl font-semibold text-ink-primary">{checked}</p>
        </div>
        <div className="rounded-2xl border border-surface-muted/30 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Total registrado</p>
          <p className="mt-2 text-2xl font-semibold text-ink-primary">{total}</p>
        </div>
        <div className="rounded-2xl border border-surface-muted/30 bg-white/70 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Estado</p>
          <p className="mt-2 text-sm font-semibold text-ink-primary">
            {valid ? 'Sin inconsistencias detectadas' : `Quiebre en ${brokenAt || 'entrada desconocida'}`}
          </p>
        </div>
      </div>

      {warning ? (
        <p className="mt-4 rounded-2xl border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-sm text-accent-text">
          {warning}
        </p>
      ) : null}

      {!valid && brokenAt ? (
        <p className="mt-4 text-sm text-status-red-text">
          Revisa el registro con id {brokenAt} y corre una verificación ampliada antes de asumir integridad operativa.
        </p>
      ) : null}
    </div>
  );
}