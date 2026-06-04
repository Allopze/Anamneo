'use client';

import { useState, useMemo } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiGrid, FiList, FiPlus, FiSettings, FiUserCheck } from 'react-icons/fi';
import { useAuthUser } from '@/stores/auth-store';
import {
  DEFAULT_FORM,
  HOUR_START,
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  SLOTS_PER_HOUR,
  TOTAL_SLOTS,
  type Appointment,
  type AppointmentForm,
} from './agenda-types';
import { CreateAppointmentModal } from './AgendaCreateModal';
import { AppointmentDetailModal } from './AgendaDetailModal';
import { useAgendaWeek } from './useAgendaWeek';
import { useAgendaMonth } from './useAgendaMonth';
import { useAgendaAppointments } from './useAgendaAppointments';
import { useAgendaPatientSearch } from './useAgendaPatientSearch';
import AgendaMonthView from './AgendaMonthView';
import { AgendaWeekView } from './AgendaWeekView';

type ViewMode = 'week' | 'month';

export default function AgendaPage() {
  const user = useAuthUser();
  const medicoId = user?.role === 'MEDICO' ? user.id : user?.medicoId ?? '';

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const { weekOffset, setWeekOffset, weekStart, weekEnd, weekDays } = useAgendaWeek();
  const { monthOffset, setMonthOffset, monthStart, gridStart, gridEnd, weeks } = useAgendaMonth();

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AppointmentForm>(DEFAULT_FORM);

  const {
    patientSearch, setPatientSearch,
    selectedPatient, setSelectedPatient,
    patientOptions, isSearchingPatients,
  } = useAgendaPatientSearch(showForm);

  const normalizedPatientSearch = patientSearch.trim();
  const rangeStart = viewMode === 'week' ? weekStart : gridStart;
  const rangeEnd = viewMode === 'week' ? weekEnd : gridEnd;

  const { appointments, isLoading, truncated, createMutation, updateMutation, attendMutation, cancelMutation } =
    useAgendaAppointments({
      medicoId,
      weekStart: rangeStart,
      weekEnd: rangeEnd,
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

  const openCreateForm = (day: Date, slotIndex?: number) => {
    const hour = slotIndex !== undefined ? HOUR_START + Math.floor(slotIndex / SLOTS_PER_HOUR) : 9;
    const minute = slotIndex !== undefined ? (slotIndex % SLOTS_PER_HOUR) * SLOT_MINUTES : 0;
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

  const headerTitle =
    viewMode === 'week'
      ? `${format(weekStart, "d 'de' MMMM", { locale: es })} – ${format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}`
      : format(monthStart, 'MMMM yyyy', { locale: es });

  const handlePrev = () => {
    if (viewMode === 'week') setWeekOffset((o) => o - 1);
    else setMonthOffset((o) => o - 1);
  };

  const handleNext = () => {
    if (viewMode === 'week') setWeekOffset((o) => o + 1);
    else setMonthOffset((o) => o + 1);
  };

  const handleToday = () => {
    if (viewMode === 'week') setWeekOffset(0);
    else setMonthOffset(0);
  };

  const isTodayActive = viewMode === 'week' ? weekOffset === 0 : monthOffset === 0;

  if (!medicoId) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Agenda</h1>
            <p className="page-header-description">Calendario clínico y coordinación de citas.</p>
          </div>
        </div>
        <div className="card grid min-h-[42vh] gap-8 p-6 text-left lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:p-8">
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-card border border-surface-muted/45 bg-surface-inset text-ink-muted">
              <FiCalendar className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Sin médico asignado</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-ink-secondary">
              Tu cuenta de asistente aún no está vinculada a un médico. La agenda se activará cuando un administrador complete esa asignación.
            </p>
          </div>
          <div className="grid content-center gap-3">
            <div className="rounded-card border border-surface-muted/45 bg-surface-inset/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-surface-elevated text-ink-secondary">
                  <FiUserCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink">Asignación médica requerida</p>
                  <p className="mt-1 text-sm leading-6 text-ink-secondary">
                    Pide que vinculen tu usuario al médico responsable antes de coordinar citas.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-card border border-surface-muted/45 bg-surface-inset/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-surface-elevated text-ink-secondary">
                  <FiSettings className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink">Ruta administrativa</p>
                  <p className="mt-1 text-sm leading-6 text-ink-secondary">
                    La configuración se realiza en ajustes del sistema por un administrador del espacio clínico.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Agenda</h1>
          <p className="capitalize text-sm text-ink-secondary">{headerTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-btn border border-surface-muted/50 bg-surface-base text-sm font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${viewMode === 'week' ? 'bg-frame text-white' : 'text-ink-secondary hover:text-ink'}`}
              aria-pressed={viewMode === 'week'}
            >
              <FiList className="h-3.5 w-3.5" />
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${viewMode === 'month' ? 'bg-frame text-white' : 'text-ink-secondary hover:text-ink'}`}
              aria-pressed={viewMode === 'month'}
            >
              <FiGrid className="h-3.5 w-3.5" />
              Mes
            </button>
          </div>
          <button
            type="button"
            onClick={handleToday}
            disabled={isTodayActive}
            className="btn btn-secondary text-sm disabled:opacity-40"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handlePrev}
            className="btn btn-secondary p-2"
            aria-label={viewMode === 'week' ? 'Semana anterior' : 'Mes anterior'}
          >
            <FiChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="btn btn-secondary p-2"
            aria-label={viewMode === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
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
          Mostrando los primeros 500 turnos del período. Si esto ocurre con frecuencia, reduce el rango de fechas o filtra por médico.
        </div>
      )}

      {viewMode === 'month' && (
        <AgendaMonthView
          weeks={weeks}
          monthStart={monthStart}
          appointments={appointments}
          isLoading={isLoading}
          onDayClick={(day) => openCreateForm(day)}
          onAppointmentClick={(appt) => { setSelectedAppt(appt); setShowForm(false); }}
        />
      )}

      {viewMode === 'week' && (
        <AgendaWeekView
          weekDays={weekDays}
          isLoading={isLoading}
          totalGridHeight={totalGridHeight}
          apptsByDay={apptsByDay}
          today={today}
          openCreateForm={openCreateForm}
          onApptClick={(appt) => { setSelectedAppt(appt); setShowForm(false); }}
        />
      )}

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
