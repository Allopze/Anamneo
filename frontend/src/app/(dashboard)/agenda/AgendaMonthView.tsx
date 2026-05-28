'use client';

import { useMemo } from 'react';
import { format, isSameDay, isSameMonth, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { STATUS_COLORS, type Appointment } from './agenda-types';

interface AgendaMonthViewProps {
  weeks: Date[][];
  monthStart: Date;
  appointments: Appointment[];
  isLoading: boolean;
  onDayClick: (day: Date) => void;
  onAppointmentClick: (appt: Appointment) => void;
}

const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function AgendaMonthView({
  weeks,
  monthStart,
  appointments,
  isLoading,
  onDayClick,
  onAppointmentClick,
}: AgendaMonthViewProps) {
  const apptsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const appt of appointments) {
      const key = format(parseISO(appt.startAt), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    }
    return map;
  }, [appointments]);

  return (
    <div className="overflow-hidden rounded-card border border-surface-muted/30 bg-surface-elevated shadow-soft">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-surface-muted/30">
        {DAY_HEADERS.map((day) => (
          <div key={day} className="py-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {day}
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-ink-muted">
          Cargando agenda…
        </div>
      ) : (
        <div className="divide-y divide-surface-muted/20">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 divide-x divide-surface-muted/20">
              {week.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayAppts = apptsByDay[key] ?? [];
                const isCurrentMonth = isSameMonth(day, monthStart);
                const today = isToday(day);

                return (
                  <div
                    key={key}
                    className={`min-h-[108px] cursor-pointer p-2 transition-colors hover:bg-surface-muted/10 ${
                      today ? 'bg-accent/4' : !isCurrentMonth ? 'bg-surface-base/40' : ''
                    }`}
                    onClick={() => onDayClick(day)}
                  >
                    {/* Day number */}
                    <div className="mb-1.5 flex items-center justify-end">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          today
                            ? 'bg-accent-text text-white'
                            : isCurrentMonth
                              ? 'text-ink'
                              : 'text-ink-muted/50'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Appointments */}
                    <div className="space-y-0.5">
                      {dayAppts.slice(0, 3).map((appt) => (
                        <button
                          key={appt.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick(appt);
                          }}
                          className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-80 ${
                            STATUS_COLORS[appt.status] ?? STATUS_COLORS.PROGRAMADA
                          }`}
                        >
                          {format(parseISO(appt.startAt), 'HH:mm')}{' '}
                          {appt.title || appt.patient?.nombre || 'Cita'}
                        </button>
                      ))}
                      {dayAppts.length > 3 && (
                        <p className="px-1 text-[10px] font-medium text-ink-muted">
                          +{dayAppts.length - 3} más
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
