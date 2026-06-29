/**
 * Types, constants, and pure helpers for SystemTab.tsx.
 */

export type SystemHealthResponse = {
  status: 'ok' | 'degraded';
  database: {
    status: 'ok' | 'error';
    driver: 'postgres';
  };
  operational: {
    enabled: boolean;
    driver: 'postgres';
    status: 'ok' | 'warn';
    version: string | null;
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

export const WARNING_LABELS: Record<string, string> = {
  no_backup_found: 'No se encontró un backup reciente.',
  latest_backup_is_stale: 'El último backup ya superó la antigüedad tolerada.',
  restore_drill_never_ran: 'Aún no hay una prueba de restauración registrada.',
  restore_drill_overdue: 'La prueba de restauración ya venció según la cadencia configurada.',
  waiting_locks_detected: 'Hay locks esperando en PostgreSQL.',
  long_running_locks_detected: 'Hay locks o consultas largas que requieren revisión.',
};

export const OPERATIONAL_CHECKLIST = [
  {
    title: 'Backup fresco',
    detail: 'Confirma que el último backup esté dentro de la ventana esperada antes de cerrar la jornada.',
  },
  {
    title: 'Restore drill vigente',
    detail: 'Si la prueba de restauración está vencida, agenda el simulacro antes del próximo despliegue o cambio operativo.',
  },
  {
    title: 'Concurrencia bajo control',
    detail: 'Revisa conexiones activas y locks antes de cambios operativos o ventanas de alta demanda.',
  },
  {
    title: 'Monitoreo diario',
    detail: 'Usa el monitor para revisar que no se acumulen advertencias repetidas ni fallas silenciosas.',
  },
] as const;

export const RUNBOOK_COMMANDS = [
  'npm run db:ops',
  'npm run db:restore:drill',
  'npm run db:ops:monitor',
] as const;

export function formatDateTime(value: string | null) {
  if (!value) return 'Sin registro';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin registro';

  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

export function formatBytes(value: number | null) {
  if (value === null) return 'Sin dato';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
