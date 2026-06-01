'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';

type DashboardSystemHealthResponse = {
  operational: {
    enabled: boolean;
    driver: 'postgres';
    sizeBytes: number | null;
    connections: {
      total: number;
      active: number;
      idle: number;
    };
    locks: {
      waiting: number;
      longRunning: number;
    };
    backups: {
      latestBackupFile: string | null;
      latestBackupAt: string | null;
      latestBackupAgeHours: number | null;
      maxAgeHours: number;
      isFresh: boolean;
    };
    restoreDrill: {
      lastRestoreDrillAt: string | null;
      lastRestoreDrillAgeDays: number | null;
      frequencyDays: number;
      isDue: boolean;
    };
  };
};

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Sin registro';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Sin registro';
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

export default function DashboardOperationalChecks() {
  const systemQuery = useQuery({
    queryKey: ['dashboard-operational-checks'],
    queryFn: async () => (await api.get('/health/database')).data as DashboardSystemHealthResponse,
    staleTime: 60_000,
  });

  if (systemQuery.isLoading) {
    return <div className="h-36 skeleton rounded-card" aria-hidden="true" />;
  }

  if (systemQuery.isError || !systemQuery.data) {
    return (
      <section className="rounded-card border border-status-yellow/40 bg-status-yellow/10 p-5 text-sm text-accent-text">
        <p className="font-semibold text-ink-primary">Chequeos operativos</p>
        <p className="mt-2">No se pudo cargar el resumen de backup y restore drill: {getErrorMessage(systemQuery.error)}</p>
        <Link href="/ajustes?tab=sistema" className="btn btn-secondary mt-4 inline-flex">
          Abrir ajustes del sistema
        </Link>
      </section>
    );
  }

  const { operational } = systemQuery.data;

  return (
    <section className="rounded-card bg-surface-elevated p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-ink-muted">Chequeos operativos</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Backup y restore drill</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Resumen visible de PostgreSQL para no depender sólo de scripts o del tab de sistema.
          </p>
        </div>

        <Link href="/ajustes?tab=sistema" className="btn btn-secondary inline-flex">
          Abrir ajustes del sistema
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-surface-muted/30 bg-white/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink-primary">Backup reciente</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${operational.backups.isFresh ? 'bg-status-green/20 text-status-green-text' : 'bg-status-red/15 text-status-red-text'}`}>
              {operational.backups.isFresh ? 'Fresco' : 'Vencido'}
            </span>
          </div>
          <p className="mt-3 text-sm text-ink-secondary">{formatDateTime(operational.backups.latestBackupAt)}</p>
          <p className="mt-1 text-sm text-ink-secondary">{operational.backups.latestBackupFile || 'Sin archivo detectado'}</p>
          <p className="mt-3 text-xs text-ink-muted">
            {operational.backups.latestBackupAgeHours === null
              ? 'Sin antigüedad calculada'
              : `Antigüedad ${operational.backups.latestBackupAgeHours} h de un máximo de ${operational.backups.maxAgeHours} h`}
          </p>
        </div>

        <div className="rounded-2xl border border-surface-muted/30 bg-white/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink-primary">Restore drill</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${operational.restoreDrill.isDue ? 'bg-status-red/15 text-status-red-text' : 'bg-status-green/20 text-status-green-text'}`}>
              {operational.restoreDrill.isDue ? 'Pendiente' : 'Vigente'}
            </span>
          </div>
          <p className="mt-3 text-sm text-ink-secondary">{formatDateTime(operational.restoreDrill.lastRestoreDrillAt)}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {operational.restoreDrill.lastRestoreDrillAgeDays === null
              ? 'Todavía no hay simulacro registrado'
              : `Hace ${operational.restoreDrill.lastRestoreDrillAgeDays} días`}
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            Cadencia objetivo: cada {operational.restoreDrill.frequencyDays} días
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-muted">
        Conexiones: {operational.connections.total} total, {operational.connections.active} activas. Locks esperando: {operational.locks.waiting}.
      </p>
    </section>
  );
}
