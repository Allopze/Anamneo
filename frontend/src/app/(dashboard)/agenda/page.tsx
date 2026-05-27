'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  addDays,
  isSameDay,
  parseISO,
  setHours,
  setMinutes,
  differenceInMinutes,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { FiChevronLeft, FiChevronRight, FiPlus, FiX, FiCalendar } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthUser } from '@/stores/auth-store';
import toast from 'react-hot-toast';

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_MINUTES = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
const TOTAL_SLOTS = (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;
const SLOT_HEIGHT_PX = 48;

type AppointmentStatus = 'PROGRAMADA' | 'CONFIRMADA' | 'NO_SHOW' | 'ATENDIDA' | 'CANCELADA';

interface Appointment {
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

interface PatientSearchResult {
  id: string;
  nombre: string;
  rut?: string | null;
  rutExempt?: boolean;
  rutExemptReason?: string | null;
}

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  PROGRAMADA: 'bg-accent/20 border-accent/40 text-accent-text',
  CONFIRMADA: 'bg-status-green/20 border-status-green/40 text-status-green-text',
  NO_SHOW:    'bg-status-red/15 border-status-red/30 text-status-red',
  ATENDIDA:   'bg-surface-muted/50 border-surface-muted text-ink-muted',
  CANCELADA:  'bg-surface-muted/30 border-surface-muted/50 text-ink-muted line-through',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  NO_SHOW: 'No asistió',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
};

interface AppointmentForm {
  patientName: string;
  startDate: string;
  startTime: string;
  endTime: string;
  title: string;
  notes: string;
  status: AppointmentStatus;
}

const DEFAULT_FORM: AppointmentForm = {
  patientName: '',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  startTime: '09:00',
  endTime: '09:30',
  title: '',
  notes: '',
  status: 'PROGRAMADA',
};

export default function AgendaPage() {
  const router = useRouter();
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AppointmentForm>(DEFAULT_FORM);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset],
  );
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const medicoId = user?.role === 'MEDICO' ? user.id : user?.medicoId ?? '';

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', medicoId, weekStart.toISOString()],
    queryFn: async () => {
      const res = await api.get<Appointment[]>('/appointments', {
        params: {
          medicoId,
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
        },
      });
      return res.data;
    },
    enabled: Boolean(medicoId),
    staleTime: 30_000,
  });

  const normalizedPatientSearch = patientSearch.trim();
  const { data: patientOptions = [], isFetching: isSearchingPatients } = useQuery({
    queryKey: ['agenda-patient-search', normalizedPatientSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '8');
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');
      params.set('search', normalizedPatientSearch);
      const res = await api.get(`/patients?${params.toString()}`);
      return res.data.data as PatientSearchResult[];
    },
    enabled: showForm && normalizedPatientSearch.length >= 2,
    staleTime: 30_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['appointments', medicoId, weekStart.toISOString()] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const start = new Date(`${form.startDate}T${form.startTime}:00`);
      const end = new Date(`${form.startDate}T${form.endTime}:00`);
      await api.post('/appointments', {
        medicoId,
        patientId: selectedPatient?.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        title: form.title.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Cita creada');
      setShowForm(false);
      setForm(DEFAULT_FORM);
      setPatientSearch('');
      setSelectedPatient(null);
      void invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      await api.put(`/appointments/${id}`, { status });
    },
    onSuccess: () => {
      toast.success('Estado actualizado');
      setSelectedAppt(null);
      void invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const attendMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      if (!appt.patientId) {
        throw new Error('La cita debe estar vinculada a un paciente antes de atender');
      }
      const response = await api.post(`/encounters/patient/${appt.patientId}`, {
        appointmentId: appt.id,
      });
      return response.data as { id: string; reused?: boolean };
    },
    onSuccess: async (encounter) => {
      toast.success(encounter.reused ? 'Atención en curso asociada a la cita' : 'Atención creada desde la cita');
      setSelectedAppt(null);
      await invalidate();
      router.push(`/atenciones/${encounter.id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/appointments/${id}`, { data: {} });
    },
    onSuccess: () => {
      toast.success('Cita cancelada');
      setSelectedAppt(null);
      void invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openCreateForm = (day: Date, slotIndex: number) => {
    const hour = HOUR_START + Math.floor(slotIndex / SLOTS_PER_HOUR);
    const minute = (slotIndex % SLOTS_PER_HOUR) * SLOT_MINUTES;
    const endMinute = minute + SLOT_MINUTES;
    const endHour = endMinute >= 60 ? hour + 1 : hour;
    const pad = (n: number) => String(n).padStart(2, '0');
    setForm({
      ...DEFAULT_FORM,
      startDate: format(day, 'yyyy-MM-dd'),
      startTime: `${pad(hour)}:${pad(minute)}`,
      endTime: `${pad(endHour)}:${pad(endMinute % 60)}`,
    });
    setPatientSearch('');
    setSelectedPatient(null);
    setShowForm(true);
    setSelectedAppt(null);
  };

  const getApptPosition = (appt: Appointment) => {
    const start = parseISO(appt.startAt);
    const end = parseISO(appt.endAt);
    const startMinutes = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
    const durationMinutes = differenceInMinutes(end, start);
    const topPx = (startMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX;
    const heightPx = Math.max((durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX, SLOT_HEIGHT_PX / 2);
    return { top: topPx, height: heightPx };
  };

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const day of weekDays) {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = appointments.filter((a) => isSameDay(parseISO(a.startAt), day));
    }
    return map;
  }, [appointments, weekDays]);

  const today = new Date();
  const totalGridHeight = TOTAL_SLOTS * SLOT_HEIGHT_PX;

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Agenda</h1>
          <p className="text-sm text-ink-secondary">
            {format(weekStart, "d 'de' MMMM", { locale: es })} –{' '}
            {format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="btn btn-secondary text-sm disabled:opacity-40"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="btn btn-secondary p-2"
            aria-label="Semana anterior"
          >
            <FiChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="btn btn-secondary p-2"
            aria-label="Semana siguiente"
          >
            <FiChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setSelectedAppt(null);
              setForm(DEFAULT_FORM);
              setPatientSearch('');
              setSelectedPatient(null);
            }}
            className="btn btn-primary flex items-center gap-2 text-sm"
          >
            <FiPlus className="h-4 w-4" />
            Nueva cita
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-card border border-surface-muted/30 bg-surface-elevated shadow-soft">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-surface-muted/30">
          <div className="py-3" />
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <div key={day.toISOString()} className="border-l border-surface-muted/20 py-3 text-center">
                <p className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-accent-text' : 'text-ink-muted'}`}>
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p className={`mt-0.5 text-lg font-bold ${isToday ? 'text-accent-text' : 'text-ink'}`}>
                  {format(day, 'd')}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-sm text-ink-muted">
            Cargando agenda…
          </div>
        ) : (
          <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: `${totalGridHeight}px` }}>
            {/* Time labels column */}
            <div className="relative border-r border-surface-muted/20">
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                <div
                  key={i}
                  className="absolute w-full pr-2 text-right text-[10px] text-ink-muted"
                  style={{ top: `${i * SLOTS_PER_HOUR * SLOT_HEIGHT_PX - 6}px` }}
                >
                  {String(HOUR_START + i).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayAppts = apptsByDay[key] ?? [];
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={key}
                  className={`relative border-l border-surface-muted/20 ${isToday ? 'bg-accent/3' : ''}`}
                >
                  {/* Hour/slot lines */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) => (
                    <div
                      key={slotIdx}
                      className={`absolute w-full cursor-pointer hover:bg-surface-muted/20 ${
                        slotIdx % SLOTS_PER_HOUR === 0 ? 'border-t border-surface-muted/30' : 'border-t border-surface-muted/10'
                      }`}
                      style={{ top: `${slotIdx * SLOT_HEIGHT_PX}px`, height: `${SLOT_HEIGHT_PX}px` }}
                      onClick={() => openCreateForm(day, slotIdx)}
                    />
                  ))}

                  {/* Appointments */}
                  {dayAppts.map((appt) => {
                    const { top, height } = getApptPosition(appt);
                    return (
                      <button
                        key={appt.id}
                        type="button"
                        className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-1.5 py-0.5 text-left text-xs font-medium shadow-sm transition-opacity hover:opacity-90 ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.PROGRAMADA}`}
                        style={{ top: `${top}px`, height: `${height}px`, zIndex: 10 }}
                        onClick={(e) => { e.stopPropagation(); setSelectedAppt(appt); setShowForm(false); }}
                      >
                        <p className="truncate leading-tight">
                          {format(parseISO(appt.startAt), 'HH:mm')} {appt.title || appt.patient?.nombre || 'Cita'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-card border border-surface-muted/40 bg-surface-elevated p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Nueva cita</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-surface-muted/30">
                <FiX className="h-4 w-4 text-ink-muted" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
              <div>
                <label className="form-label text-xs">Paciente (opcional)</label>
                <input
                  value={selectedPatient ? selectedPatient.nombre : patientSearch}
                  onChange={(e) => {
                    setSelectedPatient(null);
                    setPatientSearch(e.target.value);
                  }}
                  className="form-input mt-0.5"
                  placeholder="Buscar por nombre o RUT"
                />
                {selectedPatient && (
                  <p className="mt-1 text-xs text-ink-muted">
                    Vinculado a {selectedPatient.nombre}
                    {selectedPatient.rut ? ` · ${selectedPatient.rut}` : ''}
                  </p>
                )}
                {!selectedPatient && normalizedPatientSearch.length >= 2 && (
                  <div className="mt-1 max-h-36 overflow-y-auto rounded-input border border-surface-muted/30 bg-surface-base text-sm">
                    {isSearchingPatients ? (
                      <p className="px-3 py-2 text-xs text-ink-muted">Buscando pacientes…</p>
                    ) : patientOptions.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-ink-muted">Sin coincidencias</p>
                    ) : patientOptions.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientSearch(patient.nombre);
                        }}
                        className="block w-full px-3 py-2 text-left hover:bg-surface-muted/30"
                      >
                        <span className="block font-medium text-ink">{patient.nombre}</span>
                        <span className="text-xs text-ink-muted">
                          {patient.rut || (patient.rutExempt ? `Sin RUT: ${patient.rutExemptReason || 'exento'}` : 'RUT pendiente')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label text-xs">Fecha</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="form-input mt-0.5"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Hora inicio</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="form-input mt-0.5"
                    required
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Hora fin</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="form-input mt-0.5"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label text-xs">Título / motivo (opcional)</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="form-input mt-0.5"
                  placeholder="Ej: Consulta de control, Procedimiento…"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="form-label text-xs">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="form-input mt-0.5 resize-none"
                  rows={2}
                  placeholder="Observaciones adicionales"
                  maxLength={1000}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary text-sm">
                  {createMutation.isPending ? 'Creando…' : 'Crear cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment detail modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-card border border-surface-muted/40 bg-surface-elevated p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiCalendar className="h-4 w-4 text-ink-muted" />
                <h2 className="text-base font-bold text-ink">Detalle de cita</h2>
              </div>
              <button type="button" onClick={() => setSelectedAppt(null)} className="rounded p-1 hover:bg-surface-muted/30">
                <FiX className="h-4 w-4 text-ink-muted" />
              </button>
            </div>

            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-ink-muted">Fecha y hora</dt>
                <dd className="font-medium">
                  {format(parseISO(selectedAppt.startAt), "EEEE d 'de' MMMM, HH:mm", { locale: es })} –{' '}
                  {format(parseISO(selectedAppt.endAt), 'HH:mm')}
                </dd>
              </div>
              {selectedAppt.title && (
                <div>
                  <dt className="text-xs text-ink-muted">Motivo</dt>
                  <dd className="font-medium">{selectedAppt.title}</dd>
                </div>
              )}
              {selectedAppt.patient && (
                <div>
                  <dt className="text-xs text-ink-muted">Paciente</dt>
                  <dd className="font-medium">
                    {selectedAppt.patient.nombre}
                    {selectedAppt.patient.rut ? ` · ${selectedAppt.patient.rut}` : ''}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-ink-muted">Estado</dt>
                <dd>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[selectedAppt.status] ?? ''}`}>
                    {STATUS_LABELS[selectedAppt.status] ?? selectedAppt.status}
                  </span>
                </dd>
              </div>
              {selectedAppt.notes && (
                <div>
                  <dt className="text-xs text-ink-muted">Notas</dt>
                  <dd>{selectedAppt.notes}</dd>
                </div>
              )}
            </dl>

            {selectedAppt.status !== 'CANCELADA' && selectedAppt.status !== 'ATENDIDA' && (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-medium text-ink-muted">Cambiar estado:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedAppt.patientId && (
                    <button
                      type="button"
                      onClick={() => attendMutation.mutate(selectedAppt)}
                      disabled={attendMutation.isPending}
                      className="rounded-full border border-accent/40 bg-accent px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      {attendMutation.isPending ? 'Abriendo…' : 'Atender'}
                    </button>
                  )}
                  {(['PROGRAMADA', 'CONFIRMADA', 'NO_SHOW', 'ATENDIDA'] as AppointmentStatus[])
                    .filter((s) => s !== selectedAppt.status)
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateMutation.mutate({ id: selectedAppt.id, status: s })}
                        disabled={updateMutation.isPending}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${STATUS_COLORS[s]}`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                </div>
                <div className="mt-3 border-t border-surface-muted/30 pt-3">
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate(selectedAppt.id)}
                    disabled={cancelMutation.isPending}
                    className="text-xs text-status-red hover:underline disabled:opacity-50"
                  >
                    {cancelMutation.isPending ? 'Cancelando…' : 'Cancelar cita'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
