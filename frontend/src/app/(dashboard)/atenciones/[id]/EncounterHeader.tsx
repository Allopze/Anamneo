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
  const totalSections = sections.length;
  const progressLabel = `${completedCount}/${totalSections} secciones`;

  return (
    <header className="border-b border-frame/10 bg-surface-elevated/96 shadow-[0_1px_0_rgba(43,43,43,0.02)]">
      <div className="w-full px-4 py-4 lg:px-6 xl:px-8">
        <div className="grid gap-5 xl:grid-cols-[minmax(28rem,1fr)_minmax(20rem,28rem)] xl:items-end">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <Link
                href={`/pacientes/${encounter.patientId}`}
                aria-label="Volver al paciente"
                className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-surface-muted/60 bg-surface-base text-ink-secondary transition-colors hover:border-frame/20 hover:bg-surface-muted/20 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20"
              >
                <FiArrowLeft className="h-4 w-4" />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-secondary">
                  <span>Atención</span>
                  <span className="h-1 w-1 rounded-full bg-surface-muted" aria-hidden="true" />
                  <span>{encounter.patient?.rut || 'Sin RUT'}</span>
                  <span className="h-1 w-1 rounded-full bg-surface-muted" aria-hidden="true" />
                  <span>{formatDateTime(encounter.createdAt)}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <FiClock className="h-3.5 w-3.5" />
                    {elapsedLabel}
                  </span>
                </div>
                <h1 className="mt-2 break-words text-[1.65rem] font-extrabold leading-tight tracking-tight text-ink sm:truncate sm:text-[1.9rem] lg:text-[2.15rem]">
                  {encounter.patient?.nombre}
                </h1>
                {patientMeta.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-ink-secondary">
                    {patientMeta.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className={clsx(
                          'inline-flex min-h-7 items-center rounded-lg border border-surface-muted/40 bg-surface-inset/50 px-3',
                          index === 0 && 'tabular-nums',
                        )}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-surface-muted/40 bg-surface-inset/50 p-4 xl:justify-self-end">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-ink-secondary">Progreso de la atención</span>
              <span className="shrink-0 font-medium text-ink">
                {progressLabel}
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted/50"
              aria-label={`Progreso de la atención: ${progressLabel}`}
              aria-valuemin={0}
              aria-valuemax={totalSections}
              aria-valuenow={completedCount}
              role="progressbar"
            >
              <div
                className={clsx(
                  'h-full rounded-full bg-accent transition-[width] duration-300',
                  progressPercentage > 0 && 'min-w-[0.5rem]',
                )}
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
