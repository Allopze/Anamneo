'use client';

import { useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiClipboard, FiHeart, FiShield } from 'react-icons/fi';

import { api } from '@/lib/api';
import { splitHistoryField } from '@/lib/clinical';
import { buildClinicalAlertItems } from '@/lib/clinical-alerts';
import type { PatientClinicalSummary, Patient } from '@/types';

interface EncounterClinicalSummaryCardProps {
  patientId: string;
  patient?: Patient | null;
}

export default function EncounterClinicalSummaryCard({ patientId, patient }: EncounterClinicalSummaryCardProps) {
  const { data: clinicalSummary } = useQuery({
    queryKey: ['patient-clinical-summary', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}/clinical-summary`);
      return res.data as PatientClinicalSummary;
    },
    staleTime: 60_000,
  });

  if (!patient) {
    return null;
  }

  const allergies = splitHistoryField(patient.history?.alergias);
  const habitualMedication = splitHistoryField(patient.history?.medicamentos);
  const activeProblems = (patient.problems ?? []).filter((problem) => problem.status !== 'RESUELTO');
  const alerts = buildClinicalAlertItems(patient, clinicalSummary);

  return (
    <section className="overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-soft">
      <div className="border-b border-surface-muted/35 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Resumen clínico fijo</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Lectura rápida del contexto más relevante antes de seguir editando la atención.
            </p>
          </div>
          <p className="text-xs text-ink-muted">
            {clinicalSummary?.counts?.activeProblems ?? activeProblems.length} problemas activos ·{' '}
            {clinicalSummary?.counts?.pendingTasks ?? 0} seguimientos pendientes
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-card border border-surface-muted/40 bg-surface-base/65 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FiAlertTriangle className="h-4 w-4 text-status-red" />
              Alergias
            </div>
            <div className="mt-3 space-y-2 text-sm text-ink-secondary">
              {allergies.items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {allergies.items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-status-red/25 bg-status-red/10 px-2.5 py-1 text-xs font-medium text-status-red-text"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {allergies.text ? <p>{allergies.text}</p> : null}
              {!allergies.items.length && !allergies.text ? <p>Sin registro</p> : null}
            </div>
          </div>

          <div className="rounded-card border border-surface-muted/40 bg-surface-base/65 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FiHeart className="h-4 w-4 text-status-green" />
              Medicación habitual
            </div>
            <div className="mt-3 space-y-2 text-sm text-ink-secondary">
              {habitualMedication.items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {habitualMedication.items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-status-green/25 bg-status-green/10 px-2.5 py-1 text-xs font-medium text-status-green-text"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {habitualMedication.text ? <p>{habitualMedication.text}</p> : null}
              {!habitualMedication.items.length && !habitualMedication.text ? <p>Sin registro</p> : null}
            </div>
          </div>

          <div className="rounded-card border border-surface-muted/40 bg-surface-base/65 p-4 sm:col-span-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FiClipboard className="h-4 w-4 text-accent-text" />
              Problemas activos
            </div>
            {activeProblems.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-ink-secondary">
                {activeProblems.slice(0, 6).map((problem) => (
                  <span
                    key={problem.id}
                    className="inline-flex items-center gap-2 rounded-full border border-surface-muted/50 bg-surface-elevated px-3 py-1.5"
                  >
                    <span className="font-medium text-ink">{problem.label}</span>
                    <span className="text-ink-muted">{problem.status.toLowerCase()}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-secondary">Sin problemas activos registrados.</p>
            )}
          </div>
        </div>

        <div className="rounded-card border border-surface-muted/40 bg-surface-base/65 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FiShield className="h-4 w-4 text-status-yellow" />
            Alertas
          </div>
          {alerts.length > 0 ? (
            <div className="mt-3 space-y-2">
              {alerts.slice(0, 6).map((alert) => (
                <div
                  key={`${alert.label}-${alert.value}`}
                  className={`rounded-card border px-3 py-2 text-sm ${
                    alert.type === 'warning'
                      ? 'border-status-yellow/50 bg-status-yellow/15 text-ink'
                      : 'border-surface-muted/40 bg-surface-elevated/70 text-ink-secondary'
                  }`}
                >
                  <p className="font-medium text-ink">{alert.label}</p>
                  <p className="mt-1 text-sm text-ink-secondary">{alert.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-secondary">No hay alertas clínicas relevantes.</p>
          )}
        </div>
      </div>
    </section>
  );
}