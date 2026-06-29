import Link from 'next/link';
import clsx from 'clsx';
import { FiArchive, FiClock, FiRefreshCw, FiRotateCcw } from 'react-icons/fi';
import type { PatientOperationalHistoryItem } from '@/types';

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const EVENT_META: Record<PatientOperationalHistoryItem['reason'], { icon: typeof FiClock; tone: string }> = {
  PATIENT_ARCHIVED: {
    icon: FiArchive,
    tone: 'border-amber-300 bg-amber-50 text-amber-950',
  },
  PATIENT_RESTORED: {
    icon: FiRefreshCw,
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  },
  ENCOUNTER_CANCELLED: {
    icon: FiClock,
    tone: 'border-slate-300 bg-slate-100 text-slate-900',
  },
  ENCOUNTER_REOPENED: {
    icon: FiRotateCcw,
    tone: 'border-sky-300 bg-sky-50 text-sky-950',
  },
};

export default function PatientOperationalHistoryCard({
  items,
  isLoading,
}: {
  items: PatientOperationalHistoryItem[] | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Historial operativo</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Archivo, restauración y reaperturas relevantes asociadas a esta ficha.
          </p>
        </div>
        <span className="text-sm text-ink-muted">{items?.length ?? 0} eventos</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-20 rounded-card skeleton" />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <ol className="space-y-3">
          {items.map((item) => {
            const meta = EVENT_META[item.reason];
            const Icon = meta.icon;

            return (
              <li key={item.id} className="rounded-[24px] border border-surface-muted/40 bg-surface-elevated p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                          meta.tone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {dateFormatter.format(new Date(item.timestamp))} · {item.userName}
                      </span>
                    </div>
                    {item.detail ? <p className="mt-3 text-sm leading-6 text-ink-secondary">{item.detail}</p> : null}
                  </div>

                  {item.encounterId ? (
                    <Link href={`/atenciones/${item.encounterId}`} className="btn btn-secondary shrink-0 text-sm">
                      Ver atención
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-card border border-dashed border-surface-muted/50 bg-surface-base/60 px-4 py-6 text-sm text-ink-secondary">
          Sin eventos operativos relevantes para esta ficha por ahora.
        </div>
      )}
    </div>
  );
}
