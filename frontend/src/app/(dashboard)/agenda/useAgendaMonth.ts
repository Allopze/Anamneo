'use client';

import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  eachDayOfInterval,
} from 'date-fns';

export function useAgendaMonth() {
  const [monthOffset, setMonthOffset] = useState(0);

  const monthStart = useMemo(
    () => startOfMonth(addMonths(new Date(), monthOffset)),
    [monthOffset],
  );

  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);

  const gridStart = useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 1 }),
    [monthStart],
  );

  const gridEnd = useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn: 1 }),
    [monthEnd],
  );

  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  return {
    monthOffset,
    setMonthOffset,
    monthStart,
    monthEnd,
    gridStart,
    gridEnd,
    calendarDays,
    weeks,
  };
}
