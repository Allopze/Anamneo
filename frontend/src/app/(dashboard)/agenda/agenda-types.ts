import { format } from 'date-fns';

export const HOUR_START = 8;
export const HOUR_END = 20;
export const SLOT_MINUTES = 30;
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
export const TOTAL_SLOTS = (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;
export const SLOT_HEIGHT_PX = 48;

export type AppointmentStatus = 'PROGRAMADA' | 'CONFIRMADA' | 'NO_SHOW' | 'ATENDIDA' | 'CANCELADA';

export interface Appointment {
  id: string;
  medicoId: string;
  patientId: string | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  title: string | null;
  notes: string | null;
  patient: { id: string; nombre: string | null; rut?: string | null } | null;
}

export interface PatientSearchResult {
  id: string;
  nombre: string;
  rut?: string | null;
  rutExempt?: boolean;
  rutExemptReason?: string | null;
}

export interface AppointmentForm {
  patientName: string;
  startDate: string;
  startTime: string;
  endTime: string;
  title: string;
  notes: string;
  status: AppointmentStatus;
}

export const DEFAULT_FORM: AppointmentForm = {
  patientName: '',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  startTime: '09:00',
  endTime: '09:30',
  title: '',
  notes: '',
  status: 'PROGRAMADA',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  PROGRAMADA: 'bg-accent/20 border-accent/40 text-accent-text',
  CONFIRMADA: 'bg-status-green/20 border-status-green/40 text-status-green-text',
  NO_SHOW: 'bg-status-red/15 border-status-red/30 text-status-red',
  ATENDIDA: 'bg-surface-muted/50 border-surface-muted text-ink-muted',
  CANCELADA: 'bg-surface-muted/30 border-surface-muted/50 text-ink-muted line-through',
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  NO_SHOW: 'No asistió',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
};
