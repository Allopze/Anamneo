import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

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

    return value.toISOString().slice(0, 10);
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

  return parsed.toISOString().slice(0, 10);
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
  return extractDateOnlyIso(value) < extractDateOnlyIso(reference);
}
