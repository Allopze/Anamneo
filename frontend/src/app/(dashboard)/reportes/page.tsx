'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiActivity, FiCalendar, FiClipboard, FiPieChart, FiUsers } from 'react-icons/fi';
import { EmptyState } from '@/components/common/EmptyState';
import LocalizedDateInput from '@/components/common/LocalizedDateInput';
import { api } from '@/lib/api';
import { todayLocalDateString } from '@/lib/date';
import { useAuthUser } from '@/stores/auth-store';
import { canViewOperationalReports } from '@/lib/permissions';
import { STATUS_LABELS } from '@/types/encounter.types';

interface OperationalDailySummary {
  date: string;
  summary: {
    appointmentsTotal: number;
    scheduledAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    attendedAppointments: number;
    encountersTotal: number;
    attendedFromAgenda: number;
    walkIns: number;
    uniquePatients: number;
    agendaConversionRate: number | null;
  };
  appointmentStatusCounts: Record<string, number>;
  encounterStatusCounts: Record<string, number>;
}

function formatPercent(value: number | null) {
  return value == null ? 'Sin dato' : `${Math.round(value * 100)}%`;
}

function MetricTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof FiActivity;
}) {
  return (
    <div className="rounded-card border border-surface-muted/30 bg-surface-elevated p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-input bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-primary">{value}</p>
    </div>
  );
}

export default function ReportesPage() {
  const user = useAuthUser();
  const canView = canViewOperationalReports(user);
  const [date, setDate] = useState(todayLocalDateString());
  const { data, isLoading, error } = useQuery({
    queryKey: ['operational-daily-summary', date],
    queryFn: async () => {
      const res = await api.get<OperationalDailySummary>('/analytics/operational/daily-summary', {
        params: { date },
      });
      return res.data;
    },
    enabled: canView,
    retry: false,
  });

  return (
    <div className="mx-auto w-full max-w-6xl animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Reportes operacionales</h1>
          <p className="text-sm text-ink-secondary">
            Resumen diario de agenda, atenciones y asistencia.
          </p>
        </div>
        <label className="block text-sm">
          <span className="form-label text-xs">Día</span>
          <LocalizedDateInput
            id="report-date"
            value={date}
            onChange={setDate}
            className="form-input mt-1"
          />
        </label>
      </div>

      {!canView ? (
        <EmptyState
          icon={<FiPieChart className="h-6 w-6" aria-hidden="true" />}
          title="Reportes disponibles para el rol clínico"
          description="Los reportes operacionales (agenda, atenciones y asistencia) están disponibles para los perfiles Médico o Asistente. Tu cuenta no tiene acceso a estos datos clínicos."
        />
      ) : error ? (
        <div className="rounded-card border border-status-red/30 bg-status-red/10 p-4 text-sm text-status-red">
          No se pudo cargar el reporte.
        </div>
      ) : null}

      {canView && (isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-card skeleton" />
          ))}
        </div>
      ) : data ? (
        <>
          {data.summary.appointmentsTotal === 0 && data.summary.encountersTotal === 0 && (
            <EmptyState
              icon={<FiCalendar className="h-6 w-6" aria-hidden="true" />}
              title="Sin actividad registrada"
              description="No se registró actividad clínica para este día. Si esto te parece incorrecto, verifica que las citas y atenciones estén asociadas a esta fecha."
            />
          )}
          <div className="grid gap-4 md:grid-cols-4">
            <MetricTile label="Citas programadas" value={data.summary.scheduledAppointments} icon={FiCalendar} />
            <MetricTile label="Atenciones" value={data.summary.encountersTotal} icon={FiClipboard} />
            <MetricTile label="Pacientes únicos" value={data.summary.uniquePatients} icon={FiUsers} />
            <MetricTile label="Conversión agenda" value={formatPercent(data.summary.agendaConversionRate)} icon={FiActivity} />
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-card border border-surface-muted/30 bg-surface-elevated p-5">
              <h2 className="text-base font-semibold text-ink-primary">Agenda</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-secondary">Total de citas</dt>
                  <dd className="font-semibold text-ink-primary">{data.summary.appointmentsTotal}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-secondary">Atendidas</dt>
                  <dd className="font-semibold text-ink-primary">{data.summary.attendedAppointments}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-secondary">No-show</dt>
                  <dd className="font-semibold text-ink-primary">{data.summary.noShowAppointments}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-secondary">Canceladas</dt>
                  <dd className="font-semibold text-ink-primary">{data.summary.cancelledAppointments}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-card border border-surface-muted/30 bg-surface-elevated p-5">
              <h2 className="text-base font-semibold text-ink-primary">Atenciones</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-secondary">Desde agenda</dt>
                  <dd className="font-semibold text-ink-primary">{data.summary.attendedFromAgenda}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-secondary">Espontáneas</dt>
                  <dd className="font-semibold text-ink-primary">{data.summary.walkIns}</dd>
                </div>
                {Object.entries(data.encounterStatusCounts).map(([status, count]) => (
                  <div key={status} className="flex justify-between gap-4">
                    <dt className="text-ink-secondary">{STATUS_LABELS[status] ?? status}</dt>
                    <dd className="font-semibold text-ink-primary">{count}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </>
      ) : null)}
    </div>
  );
}
