'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { buildClinicalAlertItems } from '@/lib/clinical-alerts';
import type { Patient, PatientClinicalSummary } from '@/types';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';

interface ClinicalAlertsProps {
  patientId: string;
  variant?: 'panel' | 'workspace-sticky';
}

export default function ClinicalAlerts({ patientId, variant = 'panel' }: ClinicalAlertsProps) {
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`);
      return res.data as Patient;
    },
    staleTime: 60_000,
  });

  const { data: clinicalSummary } = useQuery({
    queryKey: ['patient-clinical-summary', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}/clinical-summary`);
      return res.data as PatientClinicalSummary;
    },
    staleTime: 60_000,
  });

  if (!patient) return null;

  const alerts = buildClinicalAlertItems(patient, clinicalSummary);

  if (alerts.length === 0) return null;

  if (variant === 'workspace-sticky') {
    return (
      <div className="sticky top-3 z-20">
        <div className="rounded-card border border-frame/10 bg-surface-elevated/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="text-sm font-medium text-ink">Alertas clínicas</span>
            <span className="text-xs text-ink-secondary">Contexto derivado, no alertas persistidas</span>
            {alerts.slice(0, 5).map((alert, index) => (
              <div
                key={`${alert.label}-${index}`}
                className={`inline-flex max-w-full items-center gap-2 rounded-input border px-3 py-1.5 text-sm ${
                  alert.type === 'warning'
                    ? 'border-status-yellow/60 bg-status-yellow/20 text-accent-text'
                    : 'border-surface-muted/40 bg-surface-base/60 text-ink-secondary'
                }`}
              >
                {alert.type === 'warning' ? (
                  <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <FiInfo className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="font-medium text-ink">{alert.label}:</span>
                <span className="truncate">{alert.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="overflow-hidden rounded-card border border-frame/10 bg-surface-elevated shadow-soft">
        <div className="border-b border-surface-muted/35 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-ink">Contexto clínico relevante</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Resumen derivado de ficha, problemas, tareas y resumen clínico longitudinal. No reemplaza las alertas clínicas persistidas.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-surface-muted/30">
          {alerts.map((alert, index) => (
            <div
              key={`${alert.label}-${index}`}
              className="flex items-start gap-3 px-5 py-4 sm:px-6"
            >
              <div
                className={`mt-0.5 shrink-0 ${
                  alert.type === 'warning'
                    ? 'text-accent-text'
                    : 'text-ink-secondary'
                }`}
              >
                {alert.type === 'warning' ? (
                  <FiAlertTriangle className="h-4 w-4" />
                ) : (
                  <FiInfo className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{alert.label}</p>
                <p className="mt-1 break-words text-sm text-ink-secondary">{alert.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
