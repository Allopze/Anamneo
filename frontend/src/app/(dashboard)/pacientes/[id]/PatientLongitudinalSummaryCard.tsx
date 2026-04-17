'use client';

import { formatDateOnly } from '@/lib/date';
import { formatHistoryFieldText } from '@/lib/clinical';
import type { Patient, PatientClinicalSummary } from '@/types';

interface PatientLongitudinalSummaryCardProps {
  patient: Patient;
  clinicalSummary?: PatientClinicalSummary;
}

export default function PatientLongitudinalSummaryCard({
  patient,
  clinicalSummary,
}: PatientLongitudinalSummaryCardProps) {
  const alergias = formatHistoryFieldText(patient.history?.alergias);
  const medicamentos = formatHistoryFieldText(patient.history?.medicamentos);
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
          <div className="mt-2 space-y-2 text-sm text-ink-secondary">
            <p>
              <span className="font-medium text-ink">Alergias:</span> {alergias || 'Sin registro'}
            </p>
            <p>
              <span className="font-medium text-ink">Medicamentos:</span> {medicamentos || 'Sin registro'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
