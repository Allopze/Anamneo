'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';

type AuditIntegrityResponse = {
  valid: boolean;
  checked: number;
  total: number;
  brokenAt?: string;
  warning?: string;
  verifiedAt: string;
  verificationScope: string;
};

export default function AuditIntegrityCard() {
  const queryClient = useQueryClient();
  const integrityQuery = useQuery({
    queryKey: ['audit-integrity-latest'],
    queryFn: async () => {
      return (await api.get('/audit/integrity/latest')).data as AuditIntegrityResponse | null;
    },
    staleTime: 60_000,
  });

  const verifyMutation = useMutation({
    mutationFn: async (mode: 'recent' | 'full') => {
      const queryString = mode === 'full' ? 'full=true' : 'limit=1000';
      return (await api.get(`/audit/integrity/verify?${queryString}`)).data as AuditIntegrityResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['audit-integrity-latest'], data);
    },
  });

  if (integrityQuery.isLoading) {
    return <div className="h-32 skeleton rounded-card" aria-hidden="true" />;
  }

  if (integrityQuery.isError) {
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

  const snapshot = verifyMutation.data ?? integrityQuery.data;
  const hasSnapshot = Boolean(snapshot);
  const valid = snapshot?.valid ?? false;
  const checked = snapshot?.checked ?? 0;
  const total = snapshot?.total ?? 0;
  const brokenAt = snapshot?.brokenAt;
  const warning = snapshot?.warning;
  const isFullVerification = snapshot?.verificationScope === 'FULL';
  const verifiedAt = snapshot?.verifiedAt
    ? new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(snapshot.verifiedAt))
    : 'Sin verificación registrada';
  const isVerifying = verifyMutation.isPending;

  return (
    <div className="rounded-card border border-surface-muted/40 bg-surface-elevated p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Integridad de auditoría</p>
          <h2 className="mt-2 text-lg font-bold text-ink-primary">
            {!hasSnapshot ? 'Integridad pendiente' : valid ? 'Cadena íntegra' : 'Cadena con quiebre detectado'}
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Última verificación: {verifiedAt}.{' '}
            {hasSnapshot
              ? isFullVerification
                ? 'Resultado completo del hash chain auditado.'
                : 'Resultado operativo sobre los registros auditables más recientes.'
              : 'Ejecuta una verificación para crear el primer estado persistido.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => verifyMutation.mutate('recent')}
            disabled={isVerifying}
          >
            Verificar reciente
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => verifyMutation.mutate('full')}
            disabled={isVerifying}
          >
            Verificar completa
          </button>
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${hasSnapshot && valid ? 'bg-status-green/20 text-status-green-text' : 'bg-status-red/15 text-status-red-text'}`}>
            {!hasSnapshot ? 'Pendiente' : valid ? 'Íntegra' : 'Atención requerida'}
          </div>
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

      {verifyMutation.isError ? (
        <p className="mt-4 rounded-2xl border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red-text">
          No se pudo completar la verificación: {getErrorMessage(verifyMutation.error)}
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
