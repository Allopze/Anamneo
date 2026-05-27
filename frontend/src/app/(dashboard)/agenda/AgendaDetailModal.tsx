'use client';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiCalendar, FiX } from 'react-icons/fi';
import type { Appointment, AppointmentStatus } from './agenda-types';
import { STATUS_COLORS, STATUS_LABELS } from './agenda-types';

interface AppointmentDetailModalProps {
  selectedAppt: Appointment;
  isUpdating: boolean;
  isAttending: boolean;
  isCanceling: boolean;
  onClose: () => void;
  onAttend: (appointment: Appointment) => void;
  onUpdateStatus: (payload: { id: string; status: AppointmentStatus }) => void;
  onCancel: (id: string) => void;
}

export function AppointmentDetailModal({
  selectedAppt,
  isUpdating,
  isAttending,
  isCanceling,
  onClose,
  onAttend,
  onUpdateStatus,
  onCancel,
}: AppointmentDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card border border-surface-muted/40 bg-surface-elevated p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiCalendar className="h-4 w-4 text-ink-muted" />
            <h2 className="text-base font-bold text-ink">Detalle de cita</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface-muted/30">
            <FiX className="h-4 w-4 text-ink-muted" />
          </button>
        </div>

        <AppointmentDetails selectedAppt={selectedAppt} />

        {selectedAppt.status !== 'CANCELADA' && selectedAppt.status !== 'ATENDIDA' ? (
          <AppointmentActions
            selectedAppt={selectedAppt}
            isUpdating={isUpdating}
            isAttending={isAttending}
            isCanceling={isCanceling}
            onAttend={onAttend}
            onUpdateStatus={onUpdateStatus}
            onCancel={onCancel}
          />
        ) : null}
      </div>
    </div>
  );
}

function AppointmentActions({
  selectedAppt,
  isUpdating,
  isAttending,
  isCanceling,
  onAttend,
  onUpdateStatus,
  onCancel,
}: Omit<AppointmentDetailModalProps, 'onClose'>) {
  return (
    <div className="mt-5 space-y-2">
      <p className="text-xs font-medium text-ink-muted">Cambiar estado:</p>
      <div className="flex flex-wrap gap-2">
        {selectedAppt.patientId ? (
          <button
            type="button"
            onClick={() => onAttend(selectedAppt)}
            disabled={isAttending}
            className="rounded-full border border-accent/40 bg-accent px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {isAttending ? 'Abriendo...' : 'Atender'}
          </button>
        ) : null}
        {(['PROGRAMADA', 'CONFIRMADA', 'NO_SHOW', 'ATENDIDA'] as AppointmentStatus[])
          .filter((status) => status !== selectedAppt.status)
          .map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onUpdateStatus({ id: selectedAppt.id, status })}
              disabled={isUpdating}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${STATUS_COLORS[status]}`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
      </div>
      <div className="mt-3 border-t border-surface-muted/30 pt-3">
        <button
          type="button"
          onClick={() => onCancel(selectedAppt.id)}
          disabled={isCanceling}
          className="text-xs text-status-red hover:underline disabled:opacity-50"
        >
          {isCanceling ? 'Cancelando...' : 'Cancelar cita'}
        </button>
      </div>
    </div>
  );
}

function AppointmentDetails({ selectedAppt }: { selectedAppt: Appointment }) {
  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="text-xs text-ink-muted">Fecha y hora</dt>
        <dd className="font-medium">
          {format(parseISO(selectedAppt.startAt), "EEEE d 'de' MMMM, HH:mm", { locale: es })} -{' '}
          {format(parseISO(selectedAppt.endAt), 'HH:mm')}
        </dd>
      </div>
      {selectedAppt.title ? (
        <div>
          <dt className="text-xs text-ink-muted">Motivo</dt>
          <dd className="font-medium">{selectedAppt.title}</dd>
        </div>
      ) : null}
      {selectedAppt.patient ? (
        <div>
          <dt className="text-xs text-ink-muted">Paciente</dt>
          <dd className="font-medium">
            {selectedAppt.patient.nombre}
            {selectedAppt.patient.rut ? ` · ${selectedAppt.patient.rut}` : ''}
          </dd>
        </div>
      ) : null}
      <div>
        <dt className="text-xs text-ink-muted">Estado</dt>
        <dd>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[selectedAppt.status] ?? ''}`}>
            {STATUS_LABELS[selectedAppt.status] ?? selectedAppt.status}
          </span>
        </dd>
      </div>
      {selectedAppt.notes ? (
        <div>
          <dt className="text-xs text-ink-muted">Notas</dt>
          <dd>{selectedAppt.notes}</dd>
        </div>
      ) : null}
    </dl>
  );
}
