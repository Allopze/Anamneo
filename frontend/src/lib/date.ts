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

    return value.toISOString().slice(0, 10);
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

  return parsed.toISOString().slice(0, 10);
}

export function toDateOnlyDisplayDate(value: string | Date | null | undefined) {
  const dateOnly = extractDateOnly(value);
  return dateOnly ? new Date(`${dateOnly}T12:00:00.000Z`) : undefined;
}

export function formatDateOnly(
  value: string | Date | null | undefined,
  pattern = 'd MMM yyyy',
) {
  const displayDate = toDateOnlyDisplayDate(value);
  return displayDate ? format(displayDate, pattern, { locale: es }) : '';
}
