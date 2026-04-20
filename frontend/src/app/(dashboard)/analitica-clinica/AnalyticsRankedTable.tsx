'use client';

import Link from 'next/link';

type AnalyticsRankedRow = {
  label: string;
  encounterCount: number;
  patientCount: number;
  badge?: string;
  subtitle?: string;
  href?: string;
  actionHref?: string;
  actionLabel?: string;
};

interface AnalyticsRankedTableProps {
  title: string;
  description: string;
  rows: AnalyticsRankedRow[];
  emptyMessage: string;
}

export function AnalyticsRankedTable({
  title,
  description,
  rows,
  emptyMessage,
}: AnalyticsRankedTableProps) {
  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-surface-muted/30 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{description}</p>
      </div>

      {rows.length > 0 ? (
        <div className="divide-y divide-surface-muted/30">
          {rows.map((row) => {
            const content = (
              <>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.href && row.actionHref ? (
                      <Link href={row.href} className="truncate text-sm font-bold text-ink hover:underline">
                        {row.label}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-bold text-ink">{row.label}</p>
                    )}
                    {row.badge ? (
                      <span className="rounded-pill bg-surface-inset px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-secondary">
                        {row.badge}
                      </span>
                    ) : null}
                  </div>
                  {row.subtitle ? <p className="mt-1 text-sm text-ink-secondary">{row.subtitle}</p> : null}
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-4 text-right text-sm sm:min-w-[180px]">
                  <div>
                    <p className="font-bold text-ink">{row.patientCount}</p>
                    <p className="text-ink-muted">Pacientes</p>
                  </div>
                  <div>
                    <p className="font-bold text-ink">{row.encounterCount}</p>
                    <p className="text-ink-muted">Atenciones</p>
                  </div>
                </div>

                {row.actionHref && row.actionLabel ? (
                  <div className="lg:col-span-2 lg:flex lg:justify-end">
                    <Link
                      href={row.actionHref}
                      className="inline-flex items-center justify-center rounded-pill border border-surface-muted/35 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-inset/40"
                    >
                      {row.actionLabel}
                    </Link>
                  </div>
                ) : null}
              </>
            );

            if (row.href && !row.actionHref) {
              return (
                <Link
                  key={`${row.label}-${row.badge ?? ''}`}
                  href={row.href}
                  className="grid gap-3 px-5 py-4 transition-colors hover:bg-surface-inset/40 sm:px-6 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={`${row.label}-${row.badge ?? ''}`}
                className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center"
              >
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-8 sm:px-6">
          <p className="text-sm text-ink-secondary">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}