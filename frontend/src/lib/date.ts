import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;

export function extractDateOnly(value: string | Date | null | undefined) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const trimmed = value.trim();
  const directMatch = DATE_ONLY_REGEX.exec(trimmed);
  if (directMatch) {
    return directMatch[0];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDateOnlyDisplayDate(value: string | Date | null | undefined) {
  const dateOnly = extractDateOnly(value);
  return dateOnly ? new Date(`${dateOnly}T12:00:00`) : undefined;
}

export function formatDateOnly(
  value: string | Date | null | undefined,
  pattern = 'd MMM yyyy',
) {
  const displayDate = toDateOnlyDisplayDate(value);
  return displayDate ? format(displayDate, pattern, { locale: es }) : '';
}

/** Returns today's date as YYYY-MM-DD in local time. */
export function todayLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type CalculatedAge = {
  edad: number;
  edadMeses: number;
};

/**
 * Calculate age (years + months) from a YYYY-MM-DD date string.
 * Returns null for invalid, future, or implausible dates.
 * Uses local time for the "today" reference so the result matches
 * the user's wall-clock day regardless of UTC offset.
 */
export function calculateAgeFromBirthDate(dateValue: string): CalculatedAge | null {
  const [yearStr, monthStr, dayStr] = dateValue.split('-');
  const year = Number.parseInt(yearStr ?? '', 10);
  const month = Number.parseInt(monthStr ?? '', 10);
  const day = Number.parseInt(dayStr ?? '', 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year
    || birthDate.getMonth() !== month - 1
    || birthDate.getDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  let totalMonths = (now.getFullYear() - year) * 12 + (now.getMonth() - (month - 1));
  if (now.getDate() < day) {
    totalMonths -= 1;
  }

  if (totalMonths < 0) {
    return null;
  }

  const edad = Math.floor(totalMonths / 12);
  if (edad > 150) {
    return null;
  }

  return { edad, edadMeses: totalMonths % 12 };
}
