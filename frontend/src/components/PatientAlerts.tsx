'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiAlertTriangle, FiCheck, FiBell } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  CRITICA: { label: 'Crítica', className: 'bg-status-red/20 text-status-red-text' },
  ALTA: { label: 'Alta', className: 'bg-status-red/10 text-status-red-text' },
  MEDIA: { label: 'Media', className: 'bg-status-yellow/40 text-accent-text' },
  BAJA: { label: 'Baja', className: 'bg-surface-muted text-ink-secondary' },
};

const TYPE_LABELS: Record<string, string> = {
  ALERGIA: 'Alergia',
  INTERACCION_MEDICAMENTOS: 'Interacción medicamentos',
  SIGNOS_VITALES: 'Signos vitales',
  RESULTADO_CRITICO: 'Resultado crítico',
  GENERAL: 'General',
};

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: { nombre: string } | null;
  createdAt: string;
  createdBy?: { nombre: string } | null;
}

interface PatientAlertsProps {
  patientId: string;
}

export default function PatientAlerts({ patientId }: PatientAlertsProps) {
  const queryClient = useQueryClient();
  const { isMedico } = useAuthStore();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', patientId],
    queryFn: async () => {
      const res = await api.get(`/alerts/patient/${patientId}?includeAcknowledged=true`);
      return res.data as Alert[];
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/alerts/${id}/acknowledge`);
    },
    onSuccess: () => {
      toast.success('Alerta reconocida');
      queryClient.invalidateQueries({ queryKey: ['alerts', patientId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const activeAlerts = alerts.filter((a) => !a.acknowledgedAt);
  const acknowledgedAlerts = alerts.filter((a) => !!a.acknowledgedAt);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-ink">Alertas Clínicas</h2>
        {activeAlerts.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-red/20 px-2.5 py-1 text-xs font-semibold text-status-red-text">
            <FiAlertTriangle className="h-3.5 w-3.5" />
            {activeAlerts.length} activa{activeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-muted py-4 text-center">Cargando...</div>
      ) : alerts.length === 0 ? (
        <div className="text-sm text-ink-muted py-4 text-center">
          <FiBell className="mx-auto h-8 w-8 mb-2 text-ink-muted/50" />
          No hay alertas clínicas
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map((alert) => {
            const sev = SEVERITY_META[alert.severity] || SEVERITY_META.BAJA;
            return (
              <div
                key={alert.id}
                className="rounded-card border border-status-red/20 bg-surface-elevated p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${sev.className}`}>
                        {sev.label}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {TYPE_LABELS[alert.type] || alert.type}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {format(new Date(alert.createdAt), "d MMM yyyy HH:mm", { locale: es })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink">{alert.title}</p>
                    <p className="mt-0.5 text-sm text-ink-secondary">{alert.message}</p>
                  </div>
                  {isMedico() && (
                    <button
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                      className="shrink-0 rounded-input border border-frame/15 bg-surface-elevated px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-base transition-colors"
                      title="Reconocer alerta"
                    >
                      <FiCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {acknowledgedAlerts.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-muted">
                Alertas reconocidas ({acknowledgedAlerts.length})
              </summary>
              <div className="mt-2 space-y-2">
                {acknowledgedAlerts.map((alert) => {
                  const sev = SEVERITY_META[alert.severity] || SEVERITY_META.BAJA;
                  return (
                    <div key={alert.id} className="rounded-card border border-surface-muted/30 bg-surface-base/40 p-3 opacity-60">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${sev.className} opacity-60`}>
                          {sev.label}
                        </span>
                        <span className="text-xs text-ink-muted">{alert.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        Reconocida por {alert.acknowledgedBy?.nombre || '—'}
                        {alert.acknowledgedAt ? ` · ${format(new Date(alert.acknowledgedAt), "d MMM yyyy", { locale: es })}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
