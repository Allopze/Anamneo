'use client';

import { useQuery } from '@tanstack/react-query';
import { api, PaginatedResponse } from '@/lib/api';
import { Encounter } from '@/types';
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
      return res.data;
    },
    staleTime: 60_000,
  });

  const { data: encounterTimeline } = useQuery({
    queryKey: ['patient-encounters-alerts', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}/encounters?page=1&limit=1`);
      return res.data as PaginatedResponse<Encounter>;
    },
    staleTime: 60_000,
  });

  if (!patient) return null;

  const history = patient.history;
  const alerts: Array<{ type: 'warning' | 'info'; label: string; value: string }> = [];

  // Parse JSON fields safely
  const parse = (raw: string | null): string => {
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      if (Array.isArray(parsed)) return parsed.join(', ');
      if (typeof parsed === 'object') return Object.values(parsed).filter(Boolean).join(', ');
      return String(parsed);
    } catch {
      return raw;
    }
  };

  const alergias = parse(history?.alergias || null);
  const medicamentos = parse(history?.medicamentos || null);
  const antecedentesMedicos = parse(history?.antecedentesMedicos || null);

  if (alergias) alerts.push({ type: 'warning', label: 'Alergias', value: alergias });
  if (medicamentos) alerts.push({ type: 'info', label: 'Medicamentos activos', value: medicamentos });
  if (antecedentesMedicos) alerts.push({ type: 'info', label: 'Antecedentes', value: antecedentesMedicos });

  const activeProblems = (patient.problems || []).filter((problem: any) => problem.status !== 'RESUELTO');
  if (activeProblems.length > 0) {
    alerts.push({
      type: 'info',
      label: 'Problemas activos',
      value: activeProblems.slice(0, 3).map((problem: any) => problem.label).join(', '),
    });
  }

  const pendingTasks = (patient.tasks || []).filter((task: any) => task.status === 'PENDIENTE' || task.status === 'EN_PROCESO');
  if (pendingTasks.length > 0) {
    alerts.push({
      type: 'warning',
      label: 'Seguimientos pendientes',
      value: pendingTasks.slice(0, 2).map((task: any) => task.title).join(', '),
    });
  }

  const recentEncounter = encounterTimeline?.data?.[0];
  const latestExam = recentEncounter?.sections?.find((section: any) => section.sectionKey === 'EXAMEN_FISICO')?.data;
  const systolic = Number(String(latestExam?.signosVitales?.presionArterial || '').split('/')[0]);
  const temperature = Number(latestExam?.signosVitales?.temperatura);
  const latestPressureLabel = latestExam?.signosVitales?.presionArterial;
  if (Number.isFinite(systolic) && systolic >= 160) {
    alerts.push({ type: 'warning', label: 'PA elevada', value: `Último registro ${latestPressureLabel}` });
  }
  if (Number.isFinite(temperature) && temperature >= 38) {
    alerts.push({ type: 'warning', label: 'Fiebre', value: `Último registro ${temperature.toFixed(1)} °C` });
  }

  if (alerts.length === 0) return null;

  if (variant === 'workspace-sticky') {
    return (
      <div className="sticky top-3 z-20">
        <div className="rounded-card border border-frame/10 bg-surface-elevated/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="text-sm font-medium text-ink">Alertas clínicas</span>
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
          <h2 className="text-sm font-semibold text-ink">Alertas Clínicas</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Datos de la ficha longitudinal que conviene tener visibles mientras editas.
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
