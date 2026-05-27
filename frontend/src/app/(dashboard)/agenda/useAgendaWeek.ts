'use client';

import { useState, useMemo } from 'react';
import { startOfWeek, endOfWeek, addWeeks, addDays } from 'date-fns';

export function useAgendaWeek() {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset],
  );
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return { weekOffset, setWeekOffset, weekStart, weekEnd, weekDays };
}
