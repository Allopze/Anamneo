import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;

const APP_TIME_ZONE = 'America/Santiago';

/** Extract YYYY-MM-DD from a Date using the app timezone (America/Santiago). */
function dateToYMD(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(date);
}

export function extractDateOnly(value: string | Date | null | undefined) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    return dateToYMD(value);
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

  return dateToYMD(parsed);
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

/** Returns today's date as YYYY-MM-DD in the app timezone (America/Santiago). */
export function todayLocalDateString(): string {
  return dateToYMD(new Date());
}

export type CalculatedAge = {
  edad: number;
  edadMeses: number;
};

/**
 * Calculate age (years + months) from a YYYY-MM-DD date string.
 * Returns null for invalid, future, or implausible dates.
 * Uses the app timezone (America/Santiago) for the "today" reference.
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

  const todayStr = dateToYMD(new Date());
  const [nowYear, nowMonth, nowDay] = todayStr.split('-').map(Number);
  let totalMonths = (nowYear - year) * 12 + (nowMonth - month);
  if (nowDay < day) {
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
