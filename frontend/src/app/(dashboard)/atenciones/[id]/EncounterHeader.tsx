import Link from 'next/link';
import clsx from 'clsx';
import {
  FiArrowLeft,
  FiClock,
  FiWifiOff,
} from 'react-icons/fi';
import type { EncounterWizardHook } from './useEncounterWizard';
import { formatDateTime } from './encounter-wizard.constants';

type Props = Pick<
  EncounterWizardHook,
  | 'encounter'
  | 'sections'
  | 'completedCount'
  | 'progressPercentage'
  | 'elapsedMinutes'
  | 'isOnline'
  | 'pendingSaveCount'
>;

export default function EncounterHeader({
  encounter,
  sections,
  completedCount,
  progressPercentage,
  elapsedMinutes,
  isOnline,
  pendingSaveCount,
}: Props) {
  if (!encounter) return null;

  const elapsedLabel =
    elapsedMinutes < 60 ? `${elapsedMinutes} min` : `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`;

  const ageLabel = encounter.patient?.edad != null
    ? `${encounter.patient.edad} años${encounter.patient.edadMeses ? ` ${encounter.patient.edadMeses}m` : ''}`
    : null;
  const patientMeta = [ageLabel, encounter.patient?.sexo, encounter.patient?.prevision].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <header className="border-b border-frame/10 bg-surface-elevated/96">
      <div className="w-full px-4 py-3.5 lg:px-6 xl:px-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(21rem,1fr)_minmax(15rem,21rem)] xl:items-center">
          {/* ── Patient info ──────────────────────── */}
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <Link
                href={`/pacientes/${encounter.patientId}`}
                aria-label="Volver al paciente"
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-surface-muted/45 bg-surface-base text-ink-secondary transition-colors hover:bg-surface-muted/18 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20"
              >
                <FiArrowLeft className="h-4 w-4" />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-secondary">
                  <span>Atención</span>
                  <span className="text-surface-muted">/</span>
                  <span>{encounter.patient?.rut || 'Sin RUT'}</span>
                  <span className="text-surface-muted">/</span>
                  <span>{formatDateTime(encounter.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <FiClock className="h-3.5 w-3.5" />
                    {elapsedLabel}
                  </span>
                </div>
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-ink lg:text-2xl">{encounter.patient?.nombre}</h1>
                {patientMeta.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-ink-secondary">
                    {patientMeta.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className={clsx(index > 0 && 'border-l border-surface-muted/70 pl-2')}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Progress ──────────────────────────── */}
          <div className="min-w-0 border-surface-muted/50 xl:border-l xl:pl-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-secondary">Progreso</span>
              <span className="shrink-0 font-medium text-ink">
                {completedCount}/{sections.length} secciones
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted/45">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(!isOnline || pendingSaveCount > 0) && (
                <div
                  className={clsx(
                    'inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                    !isOnline
                      ? 'border-status-yellow/60 bg-status-yellow/20 text-accent-text'
                      : 'border-accent/40 bg-accent/10 text-accent-text',
                  )}
                  role="status"
                >
                  <FiWifiOff className="h-3.5 w-3.5" />
                  {!isOnline
                    ? `Sin conexión${pendingSaveCount > 0 ? ` · ${pendingSaveCount} pendiente${pendingSaveCount > 1 ? 's' : ''}` : ''}`
                    : `Sincronizando ${pendingSaveCount} cambio${pendingSaveCount > 1 ? 's' : ''}…`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
