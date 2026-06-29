'use client';

import { format, isSameDay, parseISO, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  HOUR_START,
  HOUR_END,
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  SLOTS_PER_HOUR,
  STATUS_COLORS,
  TOTAL_SLOTS,
  type Appointment,
} from './agenda-types';

interface AgendaWeekViewProps {
  weekDays: Date[];
  isLoading: boolean;
  totalGridHeight: number;
  apptsByDay: Record<string, Appointment[]>;
  today: Date;
  openCreateForm: (day: Date, slotIndex?: number) => void;
  onApptClick: (appt: Appointment) => void;
}

function getApptPosition(appt: Appointment) {
  const start = parseISO(appt.startAt);
  const end = parseISO(appt.endAt);
  const startMinutes = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
  const durationMinutes = differenceInMinutes(end, start);
  const topPx = (startMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX;
  const heightPx = Math.max((durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX, SLOT_HEIGHT_PX / 2);
  return { top: topPx, height: heightPx };
}

export function AgendaWeekView({
  weekDays,
  isLoading,
  totalGridHeight,
  apptsByDay,
  today,
  openCreateForm,
  onApptClick,
}: AgendaWeekViewProps) {
  return (
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
        <div className="grid grid-cols-[56px_repeat(7,1fr)]" aria-busy="true" aria-label="Cargando agenda">
          <div className="border-r border-surface-muted/20 space-y-4 py-4 px-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-3 skeleton rounded w-8" />
            ))}
          </div>
          {[...Array(7)].map((_, dayIdx) => (
            <div key={dayIdx} className="border-l border-surface-muted/20 space-y-3 p-2">
              {[...Array(4)].map((_, slotIdx) => (
                <div key={slotIdx} className={`h-10 skeleton rounded-card ${slotIdx % 3 === 1 ? 'opacity-60' : ''}`} />
              ))}
            </div>
          ))}
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
                      className={`absolute left-0.5 right-0.5 overflow-hidden rounded-input border px-1.5 py-0.5 text-left text-xs font-medium shadow-sm transition-opacity hover:opacity-90 ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.PROGRAMADA}`}
                      style={{ top: `${top}px`, height: `${height}px`, zIndex: 10 }}
                      onClick={(e) => { e.stopPropagation(); onApptClick(appt); }}
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
  );
}
