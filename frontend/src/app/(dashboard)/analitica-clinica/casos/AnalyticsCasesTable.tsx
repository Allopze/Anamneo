'use client';

import Link from 'next/link';

export type AnalyticsCaseRow = {
  encounterId: string;
  patientId: string;
  patientName: string | null;
  patientRut: string | null;
  createdAt: string;
  status: string;
  patientAge: number | null;
  patientSex: string | null;
  patientPrevision: string | null;
  conditions: string[];
  medications: string[];
  symptoms: string[];
  foodRelation: string;
  adherenceStatus?: string | null;
  adverseEventSeverity?: string | null;
  hasTreatmentAdjustment: boolean;
  hasFavorableResponse: boolean;
  hasAdverseEvent?: boolean;
};

interface AnalyticsCasesTableProps {
  rows: AnalyticsCaseRow[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AnalyticsCasesTable({ rows }: AnalyticsCasesTableProps) {
  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-surface-muted/30 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold tracking-tight text-ink">Casos coincidentes</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Cada fila corresponde a una atención clínica real dentro de la cohorte observada.
        </p>
      </div>

      <div className="divide-y divide-surface-muted/30">
        {rows.map((row) => (
          <article key={row.encounterId} className="space-y-4 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-ink">{row.patientName || 'Paciente sin nombre'}</p>
                <p className="mt-1 text-sm text-ink-secondary">
                  {row.patientRut || 'RUT sin registrar'}
                  {row.patientAge !== null ? ` · ${row.patientAge} años` : ''}
                  {row.patientSex ? ` · ${row.patientSex}` : ''}
                  {row.patientPrevision ? ` · ${row.patientPrevision}` : ''}
                </p>
              </div>

              <div className="text-right text-sm text-ink-secondary">
                <p>{formatDate(row.createdAt)}</p>
                <p className="mt-1 font-semibold text-ink">{row.status}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <CaseList label="Condiciones" values={row.conditions} />
              <CaseList label="Medicamentos" values={row.medications} />
              <CaseList label="Síntomas" values={row.symptoms} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Lectura rápida</p>
                <p className="mt-2 text-sm text-ink-secondary">Relación con comida: {row.foodRelation}</p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Ajuste terapéutico: {row.hasTreatmentAdjustment ? 'Sí' : 'No'}
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Respuesta favorable proxy: {row.hasFavorableResponse ? 'Sí' : 'No'}
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Adherencia: {row.adherenceStatus || 'Sin registrar'}
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Evento adverso: {row.adverseEventSeverity || (row.hasAdverseEvent ? 'Registrado' : 'Sin registrar')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/atenciones/${row.encounterId}`}
                className="inline-flex items-center justify-center rounded-pill bg-accent px-3 py-2 text-sm font-semibold text-accent-text transition-opacity hover:opacity-90"
              >
                Ver atención
              </Link>
              <Link
                href={`/pacientes/${row.patientId}`}
                className="inline-flex items-center justify-center rounded-pill border border-surface-muted/35 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-inset/40"
              >
                Ver paciente
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CaseList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      {values.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={`${label}-${value}`}
              className="rounded-pill bg-surface-inset px-2.5 py-1 text-xs font-medium text-ink-secondary"
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-secondary">Sin dato estructurado.</p>
      )}
    </div>
  );
}