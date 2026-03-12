'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FiAlertTriangle, FiInfo } from 'react-icons/fi';

interface ClinicalAlertsProps {
  patientId: string;
}

export default function ClinicalAlerts({ patientId }: ClinicalAlertsProps) {
  const { data: patient } = useQuery({
    queryKey: ['patient-detail', patientId],
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`);
      return res.data;
    },
    staleTime: 60_000,
  });

  if (!patient?.history) return null;

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

  const alergias = parse(history.alergias);
  const medicamentos = parse(history.medicamentos);
  const antecedentesMedicos = parse(history.antecedentesMedicos);

  if (alergias) alerts.push({ type: 'warning', label: 'Alergias', value: alergias });
  if (medicamentos) alerts.push({ type: 'info', label: 'Medicamentos activos', value: medicamentos });
  if (antecedentesMedicos) alerts.push({ type: 'info', label: 'Antecedentes', value: antecedentesMedicos });

  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2 animate-fade-in">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm ${
            alert.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
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
