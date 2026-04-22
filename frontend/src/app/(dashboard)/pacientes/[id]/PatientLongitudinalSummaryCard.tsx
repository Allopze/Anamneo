'use client';

import { formatDateOnly } from '@/lib/date';
import { splitHistoryField } from '@/lib/clinical';
import type { Patient, PatientClinicalSummary } from '@/types';

interface PatientLongitudinalSummaryCardProps {
  patient: Patient;
  clinicalSummary?: PatientClinicalSummary;
}

export default function PatientLongitudinalSummaryCard({
  patient,
  clinicalSummary,
}: PatientLongitudinalSummaryCardProps) {
  const alergias = splitHistoryField(patient.history?.alergias);
  const medicamentos = splitHistoryField(patient.history?.medicamentos);
  const latestLines = clinicalSummary?.latestEncounterSummary?.lines ?? [];
  const diagnoses = clinicalSummary?.recentDiagnoses ?? [];
  const activeProblems = clinicalSummary?.activeProblems ?? [];
  const pendingTasks = clinicalSummary?.pendingTasks ?? [];

  return (
    <section className="card mb-6">
      <div className="flex flex-col gap-1 border-b border-surface-muted/20 pb-4">
        <h2 className="text-lg font-bold text-ink">Resumen longitudinal</h2>
        <p className="text-sm text-ink-secondary">Lectura rápida del estado clínico acumulado del paciente.</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-xs font-medium text-ink-muted">Última atención</p>
          {latestLines.length > 0 ? (
            <div className="mt-2 space-y-2 text-sm text-ink-secondary">
              {latestLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Todavía no hay un resumen clínico derivado.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-ink-muted">Diagnósticos recientes</p>
          <div className="mt-2 space-y-2 text-sm text-ink-secondary">
            {diagnoses.length > 0 ? diagnoses.slice(0, 4).map((item) => (
              <p key={item.label}>
                <span className="font-medium text-ink">{item.label}</span>
                <span className="text-ink-muted"> · {item.count} vez/veces</span>
              </p>
            )) : <p className="text-ink-muted">Sin diagnósticos resumidos.</p>}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-muted">Problemas y seguimiento</p>
          <div className="mt-2 space-y-2 text-sm text-ink-secondary">
            {activeProblems.slice(0, 2).map((problem) => (
              <p key={problem.id}>
                <span className="font-medium text-ink">{problem.label}</span>
                <span className="text-ink-muted"> · {problem.status.toLowerCase()}</span>
              </p>
            ))}
            {pendingTasks.slice(0, 2).map((task) => (
              <p key={task.id}>
                <span className="font-medium text-ink">{task.title}</span>
                <span className="text-ink-muted">{task.dueDate ? ` · ${formatDateOnly(task.dueDate)}` : ''}</span>
              </p>
            ))}
            {activeProblems.length === 0 && pendingTasks.length === 0 ? (
              <p className="text-ink-muted">Sin problemas ni seguimientos activos.</p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-muted">Alergias y medicación</p>
          <div className="mt-2 space-y-4 text-sm text-ink-secondary">
            <div className="space-y-2">
              <p className="font-medium text-ink">Alergias</p>
              {alergias.items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {alergias.items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-status-red/25 bg-status-red/10 px-2.5 py-1 text-xs font-medium text-status-red-text"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {alergias.text ? <p className="text-ink-secondary">{alergias.text}</p> : null}
              {!alergias.items.length && !alergias.text ? <p className="text-ink-muted">Sin registro</p> : null}
            </div>

            <div className="space-y-2">
              <p className="font-medium text-ink">Medicación habitual</p>
              {medicamentos.items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {medicamentos.items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-status-green/25 bg-status-green/10 px-2.5 py-1 text-xs font-medium text-status-green-text"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {medicamentos.text ? <p className="text-ink-secondary">{medicamentos.text}</p> : null}
              {!medicamentos.items.length && !medicamentos.text ? <p className="text-ink-muted">Sin registro</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
