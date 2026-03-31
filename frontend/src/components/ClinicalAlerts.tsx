'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';

interface ClinicalAlertsProps {
  patientId: string;
}

export default function ClinicalAlerts({ patientId }: ClinicalAlertsProps) {
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`);
      return res.data;
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

  const recentEncounter = patient.encounters?.[0];
  const latestExam = recentEncounter?.sections?.find((section: any) => section.sectionKey === 'EXAMEN_FISICO')?.data;
  const systolic = Number(String(latestExam?.signosVitales?.presionArterial || '').split('/')[0]);
  const temperature = Number(latestExam?.signosVitales?.temperatura);
  if (Number.isFinite(systolic) && systolic >= 160) {
    alerts.push({ type: 'warning', label: 'PA elevada', value: `Último registro ${latestExam.signosVitales.presionArterial}` });
  }
  if (Number.isFinite(temperature) && temperature >= 38) {
    alerts.push({ type: 'warning', label: 'Fiebre', value: `Último registro ${temperature.toFixed(1)} °C` });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2 animate-fade-in">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm ${
            alert.type === 'warning'
              ? 'bg-status-yellow/10 border border-status-yellow/30 text-status-yellow'
              : 'bg-accent/10 border border-blue-200 text-blue-800'
          }`}
        >
          {alert.type === 'warning' ? (
            <FiAlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <FiInfo className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <span className="font-medium">{alert.label}:</span>{' '}
            <span className="opacity-90">{alert.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
