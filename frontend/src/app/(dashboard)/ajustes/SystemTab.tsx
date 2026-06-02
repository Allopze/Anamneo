'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Dispatch, SetStateAction } from 'react';
import type { AjustesHook } from './useAjustes';
import LegalAdminSection from './LegalAdminSection';
import EncounterSectionsSettingsCard from './EncounterSectionsSettingsCard';
import MaintenanceActionsCard from './MaintenanceActionsCard';
import {
  OPERATIONAL_CHECKLIST,
  RUNBOOK_COMMANDS,
  WARNING_LABELS,
  formatBytes,
  formatDateTime,
  type SystemHealthResponse,
} from './SystemTab.helpers';

interface SystemTabProps {
  systemConfig: {
    sessionInactivityTimeoutMinutes: string;
  };
  setSystemConfig: Dispatch<SetStateAction<{ sessionInactivityTimeoutMinutes: string }>>;
  clinicMutation: AjustesHook['clinicMutation'];
}

export default function SystemTab({
  systemConfig,
  setSystemConfig,
  clinicMutation,
}: SystemTabProps) {
  const systemQuery = useQuery({
    queryKey: ['system-health', 'database'],
    queryFn: async () => (await api.get('/health/database')).data as SystemHealthResponse,
    retry: false,
    staleTime: 60_000,
  });
  const inactivityTimeoutMinutes = Number.parseInt(systemConfig.sessionInactivityTimeoutMinutes, 10);
  const inactivityTimeoutIsValid =
    Number.isFinite(inactivityTimeoutMinutes) &&
    inactivityTimeoutMinutes >= 5 &&
    inactivityTimeoutMinutes <= 240;

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

  const { operational, status } = systemQuery.data;
  const warningMessages = operational.warnings.map((w) => WARNING_LABELS[w] || w);

  return (
    <div role="tabpanel" id="tabpanel-sistema" aria-labelledby="tab-sistema" className="card space-y-8">
      {/* ── Salud del sistema ── */}
      <section>
        <div className="panel-header">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="panel-title">Información del sistema</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'ok' ? 'bg-status-green/20 text-status-green' : 'bg-status-yellow/40 text-accent-text'}`}>
                {status === 'ok' ? 'Operativo' : 'Con alertas'}
              </span>
            </div>
            <p className="text-sm text-ink-secondary">Visibilidad rápida de base, backup y restore drill.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
            <p className="text-xs font-medium text-ink-muted">Base</p>
            <p className="mt-2 text-lg font-semibold text-ink-primary">PostgreSQL</p>
            <p className="mt-1 text-sm text-ink-secondary">Estado DB: {systemQuery.data.database.status}</p>
            <p className="mt-3 text-sm text-ink-secondary">Tamaño: {formatBytes(operational.sizeBytes)}</p>
            <p className="mt-1 text-sm text-ink-secondary">Conexiones: {operational.connections.total} total, {operational.connections.active} activas</p>
            <p className="mt-1 text-sm text-ink-secondary">Locks: {operational.locks.waiting} esperando, {operational.locks.longRunning} largos</p>
          </div>

          <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
            <p className="text-xs font-medium text-ink-muted">Backup reciente</p>
            <p className="mt-2 text-lg font-semibold text-ink-primary">
              {operational.backups.latestBackupAt ? formatDateTime(operational.backups.latestBackupAt) : 'Sin backup'}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">{operational.backups.latestBackupFile || 'No se encontró archivo de backup'}</p>
            <p className="mt-3 text-sm text-ink-secondary">
              {operational.backups.latestBackupAgeHours === null ? 'Sin antigüedad calculada' : `Antigüedad: ${operational.backups.latestBackupAgeHours} h`}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">Ventana esperada: hasta {operational.backups.maxAgeHours} h</p>
          </div>

          <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
            <p className="text-xs font-medium text-ink-muted">Última prueba de restauración</p>
            <p className="mt-2 text-lg font-semibold text-ink-primary">{formatDateTime(operational.restoreDrill.lastRestoreDrillAt)}</p>
            <p className="mt-1 text-sm text-ink-secondary">
              {operational.restoreDrill.lastRestoreDrillAgeDays === null ? 'Sin simulacro registrado todavía' : `Hace ${operational.restoreDrill.lastRestoreDrillAgeDays} días`}
            </p>
            <p className="mt-3 text-sm text-ink-secondary">Cadencia objetivo: cada {operational.restoreDrill.frequencyDays} días</p>
            <p className="mt-1 text-sm text-ink-secondary">
              {operational.restoreDrill.isDue ? 'El próximo restore drill está vencido.' : 'La verificación sigue vigente.'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
          <p><strong>Versión:</strong> 1.0.0</p>
          <p className="mt-1"><strong>API:</strong> {process.env.NEXT_PUBLIC_API_URL || 'No configurada'}</p>
        </div>
      </section>

      {/* ── Documentos legales ── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-muted">Documentos legales</h3>
        <LegalAdminSection />
      </section>

      {/* ── Secciones de atención ── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-muted">Secciones de atención</h3>
        <EncounterSectionsSettingsCard />
      </section>

      {/* ── Mantenimiento ── */}
      <section className="rounded-card border border-status-yellow/40 bg-status-yellow/10 p-4">
        <h3 className="mb-1 text-sm font-semibold text-accent-text">Mantenimiento del sistema</h3>
        <p className="mb-4 text-xs text-ink-muted">Las acciones de mantenimiento son irreversibles y requieren confirmación tipeada. Ejecutar solo si eres responsable técnico.</p>
        <MaintenanceActionsCard />
      </section>

      {/* ── Sesión ── */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-muted">Política de sesión</h3>
        <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-ink-primary">Tiempo de inactividad de sesión</p>
              <p className="mt-1 text-sm text-ink-secondary">Política global aplicada a todos los usuarios autenticados del dashboard.</p>
            </div>
            <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-medium text-ink-secondary">Admin configurable</span>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <div className="md:max-w-[220px]">
              <label htmlFor="sessionInactivityTimeoutMinutes" className="form-label">Minutos antes del cierre automático</label>
              <input
                id="sessionInactivityTimeoutMinutes"
                type="number"
                min={5}
                max={240}
                step={1}
                value={systemConfig.sessionInactivityTimeoutMinutes}
                onChange={(event) => setSystemConfig((c) => ({ ...c, sessionInactivityTimeoutMinutes: event.target.value }))}
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
          <p className="mt-3 text-xs text-ink-muted">Rango permitido: entre 5 y 240 minutos. El valor por defecto es 15 minutos.</p>
          {!inactivityTimeoutIsValid ? (
            <p className="mt-2 text-sm text-status-red-text">Ingresa un número entero entre 5 y 240.</p>
          ) : null}
        </div>
      </section>

      {warningMessages.length > 0 && (
        <div className="rounded-2xl border border-status-yellow/70 bg-status-yellow/20 p-4 text-sm text-accent-text">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-ink-primary">Alertas operativas</p>
            {systemQuery.isFetching && <span className="text-xs text-ink-muted">Actualizando...</span>}
          </div>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            {warningMessages.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* ── Checklist + Runbook ── */}
      <div className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-ink-primary">Checklist operativa</p>
            <p className="mt-1 text-xs text-ink-muted">Resumen práctico del runbook PostgreSQL para no depender de una doc local.</p>
          </div>
          <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-medium text-ink-secondary">Runbook embebido</span>
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
          <p className="text-xs font-medium text-ink-muted">Comandos útiles</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RUNBOOK_COMMANDS.map((cmd) => (
              <span key={cmd} className="rounded-full border border-surface-muted/40 bg-white/80 px-3 py-1 font-mono text-xs text-ink-primary">{cmd}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
