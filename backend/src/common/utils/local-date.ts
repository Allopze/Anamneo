import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_APP_TIME_ZONE = 'America/Santiago';

function resolveAppTimeZone() {
  const configuredTimeZone = process.env.APP_TIME_ZONE?.trim() || DEFAULT_APP_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: configuredTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    throw new Error(`APP_TIME_ZONE invalida: ${configuredTimeZone}`);
  }

  return configuredTimeZone;
}

function formatDateOnlyInAppTimeZone(value: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveAppTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('No se pudo formatear la fecha en la zona horaria configurada');
  }

  return `${year}-${month}-${day}`;
}

function assertValidDateOnly(value: string, label: string) {
  const match = DATE_ONLY_REGEX.exec(value);
  if (!match) {
    throw new BadRequestException(`${label} debe tener formato YYYY-MM-DD`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${label} no es una fecha válida`);
  }
}

export function extractDateOnlyIso(value: string | Date, label = 'La fecha') {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(`${label} no es una fecha válida`);
    }

    return formatDateOnlyInAppTimeZone(value);
  }

  const trimmed = value.trim();
  const directMatch = DATE_ONLY_REGEX.exec(trimmed);
  if (directMatch) {
    assertValidDateOnly(trimmed, label);
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${label} no es una fecha válida`);
  }

  return formatDateOnlyInAppTimeZone(parsed);
}

export function parseDateOnlyToStoredUtcDate(value: string, label = 'La fecha') {
  const dateOnly = extractDateOnlyIso(value, label);
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

export function startOfUtcDay(value: string | Date) {
  const dateOnly = extractDateOnlyIso(value);
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export function isDateOnlyBeforeToday(value: string | Date, reference = new Date()) {
  return extractDateOnlyIso(value) < todayLocalDateOnly(reference);
}

export function isDateOnlyAfterToday(value: string | Date, reference = new Date()) {
  return extractDateOnlyIso(value) > todayLocalDateOnly(reference);
}

/** Returns today as YYYY-MM-DD in the configured app timezone. */
export function todayLocalDateOnly(reference = new Date()): string {
  if (Number.isNaN(reference.getTime())) {
    throw new BadRequestException('La fecha de referencia no es válida');
  }

  return formatDateOnlyInAppTimeZone(reference);
}

export function calculateAgeFromBirthDate(
  fechaNacimiento: string | Date,
  reference = new Date(),
): { edad: number; edadMeses: number } {
  const birthIso = extractDateOnlyIso(fechaNacimiento, 'Fecha de nacimiento');
  const refIso = extractDateOnlyIso(reference);

  const [bY, bM, bD] = birthIso.split('-').map(Number);
  const [rY, rM, rD] = refIso.split('-').map(Number);

  let totalMonths = (rY - bY) * 12 + (rM - bM);
  if (rD < bD) totalMonths -= 1;
  if (totalMonths < 0) totalMonths = 0;

  return { edad: Math.floor(totalMonths / 12), edadMeses: totalMonths % 12 };
}
