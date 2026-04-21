'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Dispatch, SetStateAction } from 'react';
import type { AjustesHook } from './useAjustes';

type SystemHealthResponse = {
  status: 'ok' | 'degraded';
  database: {
    status: 'ok' | 'error';
    driver: 'sqlite' | 'other';
  };
  sqlite: {
    enabled: boolean;
    status: 'ok' | 'warn' | 'not_applicable';
    files: {
      databaseSizeBytes: number | null;
      walSizeBytes: number | null;
      walWarnThresholdBytes: number;
    };
    backups: {
      latestBackupFile: string | null;
      latestBackupAt: string | null;
      latestBackupAgeHours: number | null;
      maxAgeHours: number;
      isFresh: boolean;
      backupDirectoryConfigured: boolean;
    };
    restoreDrill: {
      lastRestoreDrillAt: string | null;
      lastRestoreDrillAgeDays: number | null;
      frequencyDays: number;
      isDue: boolean;
      stateFilePresent: boolean;
    };
    warnings: string[];
  };
};

const WARNING_LABELS: Record<string, string> = {
  no_backup_found: 'No se encontró un backup reciente.',
  latest_backup_is_stale: 'El último backup ya superó la antigüedad tolerada.',
  restore_drill_never_ran: 'Aún no hay una prueba de restauración registrada.',
  restore_drill_overdue: 'La prueba de restauración ya venció según la cadencia configurada.',
  wal_size_above_threshold: 'El archivo WAL creció por encima del umbral esperado.',
  journal_mode_is_not_wal: 'SQLite no está trabajando en modo WAL.',
  synchronous_mode_is_off: 'SQLite está con synchronous=OFF.',
  busy_timeout_below_recommended_threshold: 'El busy timeout está bajo el mínimo recomendado.',
  wal_autocheckpoint_disabled: 'El autocheckpoint del WAL está deshabilitado.',
  database_file_not_found: 'No se encontró el archivo principal de la base.',
};

const OPERATIONAL_CHECKLIST = [
  {
    title: 'Backup fresco',
    detail: 'Confirma que el último backup esté dentro de la ventana esperada antes de cerrar la jornada.',
  },
  {
    title: 'Restore drill vigente',
    detail: 'Si la prueba de restauración está vencida, agenda el simulacro antes del próximo despliegue o cambio operativo.',
  },
  {
    title: 'WAL bajo control',
    detail: 'Si el WAL crece o aparecen alertas, ejecuta el bundle operativo y revisa bloqueo o checkpoint pendiente.',
  },
  {
    title: 'Monitoreo diario',
    detail: 'Usa el monitor para revisar que no se acumulen advertencias repetidas ni fallas silenciosas.',
  },
] as const;

const RUNBOOK_COMMANDS = ['npm run db:ops', 'npm run db:restore:drill', 'npm run db:ops:monitor'] as const;

interface SystemTabProps {
  systemConfig: {
    sessionInactivityTimeoutMinutes: string;
  };
  setSystemConfig: Dispatch<SetStateAction<{ sessionInactivityTimeoutMinutes: string }>>;
  clinicMutation: AjustesHook['clinicMutation'];
}

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

function formatBytes(value: number | null) {
  if (value === null) {
    return 'Sin dato';
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SystemTab({
  systemConfig,
  setSystemConfig,
  clinicMutation,
}: SystemTabProps) {
  const systemQuery = useQuery({
    queryKey: ['system-health', 'sqlite'],
    queryFn: async () => (await api.get('/health/sqlite')).data as SystemHealthResponse,
    retry: false,
    staleTime: 60_000,
  });
  const inactivityTimeoutMinutes = Number.parseInt(systemConfig.sessionInactivityTimeoutMinutes, 10);
  const inactivityTimeoutIsValid = Number.isFinite(inactivityTimeoutMinutes)
    && inactivityTimeoutMinutes >= 5
    && inactivityTimeoutMinutes <= 240;

  if (systemQuery.isLoading) {
    return (
      <div role="tabpanel" id="tabpanel-sistema" aria-labelledby="tab-sistema" className="card">
        <div className="panel-header">
          <h2 className="panel-title">Información del sistema</h2>
        </div>
        <div className="space-y-3">
          <div className="h-16 skeleton rounded-xl" />
          <div className="h-16 skeleton rounded-xl" />
          <div className="h-16 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  if (systemQuery.isError || !systemQuery.data) {
    return (
      <div role="tabpanel" id="tabpanel-sistema" aria-labelledby="tab-sistema" className="card">
        <div className="panel-header">
          <h2 className="panel-title">Información del sistema</h2>
        </div>
        <div className="rounded-xl border border-status-red/70 bg-status-red/10 p-4 text-sm text-status-red">
          <p className="font-medium">No se pudo cargar el estado operativo.</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => void systemQuery.refetch()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { sqlite, status } = systemQuery.data;
  const warningMessages = sqlite.warnings.map((warning) => WARNING_LABELS[warning] || warning);

  return (
    <div role="tabpanel" id="tabpanel-sistema" aria-labelledby="tab-sistema" className="card space-y-4">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Información del sistema</h2>
          <p className="text-sm text-ink-secondary">Visibilidad rápida de base, backup y restore drill.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            status === 'ok'
              ? 'bg-status-green/20 text-status-green'
              : 'bg-status-yellow/40 text-accent-text'
          }`}
        >
          {status === 'ok' ? 'Operativo' : 'Con alertas'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Base</p>
          <p className="mt-2 text-lg font-semibold text-ink-primary">{sqlite.enabled ? 'SQLite' : 'No aplica'}</p>
          <p className="mt-1 text-sm text-ink-secondary">Estado DB: {systemQuery.data.database.status}</p>
          <p className="mt-3 text-sm text-ink-secondary">Archivo principal: {formatBytes(sqlite.files.databaseSizeBytes)}</p>
          <p className="mt-1 text-sm text-ink-secondary">WAL: {formatBytes(sqlite.files.walSizeBytes)}</p>
        </div>

        <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Backup reciente</p>
          <p className="mt-2 text-lg font-semibold text-ink-primary">
            {sqlite.backups.latestBackupAt ? formatDateTime(sqlite.backups.latestBackupAt) : 'Sin backup'}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            {sqlite.backups.latestBackupFile || 'No se encontró archivo de backup'}
          </p>
          <p className="mt-3 text-sm text-ink-secondary">
            {sqlite.backups.latestBackupAgeHours === null
              ? 'Sin antigüedad calculada'
              : `Antigüedad: ${sqlite.backups.latestBackupAgeHours} h`}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            Ventana esperada: hasta {sqlite.backups.maxAgeHours} h
          </p>
        </div>

        <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Última prueba de restauración</p>
          <p className="mt-2 text-lg font-semibold text-ink-primary">
            {formatDateTime(sqlite.restoreDrill.lastRestoreDrillAt)}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            {sqlite.restoreDrill.lastRestoreDrillAgeDays === null
              ? 'Sin simulacro registrado todavía'
              : `Hace ${sqlite.restoreDrill.lastRestoreDrillAgeDays} días`}
          </p>
          <p className="mt-3 text-sm text-ink-secondary">
            Cadencia objetivo: cada {sqlite.restoreDrill.frequencyDays} días
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            {sqlite.restoreDrill.isDue ? 'El próximo restore drill está vencido.' : 'La verificación sigue vigente.'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
        <p>
          <strong>Versión:</strong> 1.0.0
        </p>
        <p className="mt-1">
          <strong>API:</strong> {process.env.NEXT_PUBLIC_API_URL || 'No configurada'}
        </p>
      </div>

      <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-ink-primary">Tiempo de inactividad de sesión</p>
            <p className="mt-1 text-sm text-ink-secondary">
              Política global aplicada a todos los usuarios autenticados del dashboard.
            </p>
          </div>
          <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-medium text-ink-secondary">
            Admin configurable
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="md:max-w-[220px]">
            <label htmlFor="sessionInactivityTimeoutMinutes" className="form-label">
              Minutos antes del cierre automático
            </label>
            <input
              id="sessionInactivityTimeoutMinutes"
              type="number"
              min={5}
              max={240}
              step={1}
              value={systemConfig.sessionInactivityTimeoutMinutes}
              onChange={(event) =>
                setSystemConfig((current) => ({
                  ...current,
                  sessionInactivityTimeoutMinutes: event.target.value,
                }))
              }
              className="form-input"
            />
          </div>

          <button
            type="button"
            onClick={() => clinicMutation.mutate()}
            disabled={clinicMutation.isPending || !inactivityTimeoutIsValid}
            className="btn btn-primary"
          >
            {clinicMutation.isPending ? 'Guardando…' : 'Guardar política de sesión'}
          </button>
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          Rango permitido: entre 5 y 240 minutos. El valor por defecto es 15 minutos.
        </p>
        {!inactivityTimeoutIsValid ? (
          <p className="mt-2 text-sm text-status-red-text">
            Ingresa un número entero entre 5 y 240.
          </p>
        ) : null}
      </div>

      {warningMessages.length > 0 && (
        <div className="rounded-2xl border border-status-yellow/70 bg-status-yellow/20 p-4 text-sm text-accent-text">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-ink-primary">Alertas operativas</p>
            {systemQuery.isFetching && <span className="text-xs text-ink-muted">Actualizando...</span>}
          </div>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            {warningMessages.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-ink-primary">Checklist operativa</p>
            <p className="mt-1 text-xs text-ink-muted">Resumen práctico del runbook de SQLite para no depender de una doc local.</p>
          </div>
          <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-medium text-ink-secondary">
            Runbook embebido
          </span>
        </div>

        <ol className="mt-4 space-y-3">
          {OPERATIONAL_CHECKLIST.map((item, index) => (
            <li key={item.title} className="rounded-xl border border-surface-muted/30 bg-white/70 px-4 py-3">
              <p className="font-medium text-ink-primary">{index + 1}. {item.title}</p>
              <p className="mt-1 text-sm text-ink-secondary">{item.detail}</p>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl border border-surface-muted/30 bg-surface-inset/60 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">Comandos útiles</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RUNBOOK_COMMANDS.map((command) => (
              <span key={command} className="rounded-full border border-surface-muted/40 bg-white/80 px-3 py-1 font-mono text-xs text-ink-primary">
                {command}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
