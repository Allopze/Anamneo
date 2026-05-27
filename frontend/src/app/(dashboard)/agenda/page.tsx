'use client';

import { useState, useMemo } from 'react';
import { format, isSameDay, parseISO, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { useAuthUser } from '@/stores/auth-store';
import {
  DEFAULT_FORM,
  HOUR_START,
  HOUR_END,
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  SLOTS_PER_HOUR,
  STATUS_COLORS,
  TOTAL_SLOTS,
  type Appointment,
  type AppointmentForm,
} from './agenda-types';
import { CreateAppointmentModal } from './AgendaCreateModal';
import { AppointmentDetailModal } from './AgendaDetailModal';
import { useAgendaWeek } from './useAgendaWeek';
import { useAgendaAppointments } from './useAgendaAppointments';
import { useAgendaPatientSearch } from './useAgendaPatientSearch';

export default function AgendaPage() {
  const user = useAuthUser();
  const medicoId = user?.role === 'MEDICO' ? user.id : user?.medicoId ?? '';

  const { weekOffset, setWeekOffset, weekStart, weekEnd, weekDays } = useAgendaWeek();

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AppointmentForm>(DEFAULT_FORM);

  const {
    patientSearch, setPatientSearch,
    selectedPatient, setSelectedPatient,
    patientOptions, isSearchingPatients,
  } = useAgendaPatientSearch(showForm);

  const normalizedPatientSearch = patientSearch.trim();

  const { appointments, isLoading, truncated, createMutation, updateMutation, attendMutation, cancelMutation } =
    useAgendaAppointments({
      medicoId,
      weekStart,
      weekEnd,
      form,
      selectedPatientId: selectedPatient?.id,
      onCreateSuccess: () => {
        setShowForm(false);
        setForm(DEFAULT_FORM);
        setPatientSearch('');
        setSelectedPatient(null);
      },
      onMutationSuccess: () => setSelectedAppt(null),
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

  if (!medicoId) {
    return (
      <div className="animate-fade-in flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <FiCalendar className="h-12 w-12 text-ink-muted/50" aria-hidden="true" />
        <h2 className="text-xl font-bold text-ink">Sin médico asignado</h2>
        <p className="max-w-sm text-sm text-ink-secondary">
          Tu cuenta de asistente no tiene un médico asignado. Solicita al administrador que configure la asignación en los ajustes del sistema.
        </p>
      </div>
    );
  }

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

      {truncated && (
        <div className="mb-4 rounded-card border border-status-yellow/30 bg-status-yellow/10 px-4 py-3 text-sm text-ink-secondary">
          Mostrando los primeros 500 turnos de la semana. Si esto ocurre con frecuencia, reduce el rango de fechas o filtra por médico.
        </div>
      )}

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

      {showForm && (
        <CreateAppointmentModal
          form={form}
          setForm={setForm}
          selectedPatient={selectedPatient}
          setSelectedPatient={setSelectedPatient}
          patientSearch={patientSearch}
          setPatientSearch={setPatientSearch}
          normalizedPatientSearch={normalizedPatientSearch}
          patientOptions={patientOptions}
          isSearchingPatients={isSearchingPatients}
          isCreating={createMutation.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={() => createMutation.mutate()}
        />
      )}

      {selectedAppt && (
        <AppointmentDetailModal
          selectedAppt={selectedAppt}
          isUpdating={updateMutation.isPending}
          isAttending={attendMutation.isPending}
          isCanceling={cancelMutation.isPending}
          onClose={() => setSelectedAppt(null)}
          onAttend={(appointment) => attendMutation.mutate(appointment)}
          onUpdateStatus={(payload) => updateMutation.mutate(payload)}
          onCancel={(id) => cancelMutation.mutate(id)}
        />
      )}
    </div>
  );
}
