'use client';

type AnalyticsOutcomeRow = {
  label: string;
  patientCount: number;
  encounterCount: number;
  favorableCount: number;
  favorableRate: number;
  adjustmentCount: number;
  reconsultCount: number;
  adherenceCount: number;
  adverseEventCount: number;
  subtitle?: string;
};

interface AnalyticsOutcomeTableProps {
  title: string;
  description: string;
  rows: AnalyticsOutcomeRow[];
  emptyMessage: string;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function AnalyticsOutcomeTable({
  title,
  description,
  rows,
  emptyMessage,
}: AnalyticsOutcomeTableProps) {
  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-surface-muted/30 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{description}</p>
      </div>

      {rows.length > 0 ? (
        <div className="divide-y divide-surface-muted/30">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-4 px-5 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{row.label}</p>
                {row.subtitle ? <p className="mt-1 text-sm text-ink-secondary">{row.subtitle}</p> : null}
              </div>

              <div className="grid grid-cols-2 gap-4 text-right text-sm sm:grid-cols-3 xl:grid-cols-5">
                <div>
                  <p className="font-bold text-ink">{row.patientCount}</p>
                  <p className="text-ink-muted">Pacientes</p>
                </div>
                <div>
                  <p className="font-bold text-ink">{row.encounterCount}</p>
                  <p className="text-ink-muted">Indicaciones</p>
                </div>
                <div>
                  <p className="font-bold text-ink">{row.favorableCount}</p>
                  <p className="text-ink-muted">Favorables</p>
                </div>
                <div>
                  <p className="font-bold text-ink">{row.reconsultCount}</p>
                  <p className="text-ink-muted">Reconsultas</p>
                </div>
                <div>
                  <p className="font-bold text-ink">{formatPercent(row.favorableRate)}</p>
                  <p className="text-ink-muted">Tasa favorable</p>
                </div>
              </div>

              <div className="xl:col-span-2">
                <p className="text-sm text-ink-secondary">
                  Ajuste terapéutico dentro de ventana: <span className="font-semibold text-ink">{row.adjustmentCount}</span>
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Adherencia documentada: <span className="font-semibold text-ink">{row.adherenceCount}</span>
                  {' · '}
                  Eventos adversos: <span className="font-semibold text-ink">{row.adverseEventCount}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 sm:px-6">
          <p className="text-sm text-ink-secondary">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}