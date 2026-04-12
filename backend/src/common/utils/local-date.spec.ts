import { BadRequestException } from '@nestjs/common';
import {
  extractDateOnlyIso,
  isDateOnlyBeforeToday,
  parseDateOnlyToStoredUtcDate,
  startOfUtcDay,
  todayLocalDateOnly,
} from './local-date';

describe('local-date', () => {
  const originalTimeZone = process.env.APP_TIME_ZONE;

  beforeEach(() => {
    process.env.APP_TIME_ZONE = 'America/Santiago';
  });

  afterAll(() => {
    if (originalTimeZone === undefined) {
      delete process.env.APP_TIME_ZONE;
      return;
    }

    process.env.APP_TIME_ZONE = originalTimeZone;
  });

  it('preserves valid date-only strings', () => {
    expect(extractDateOnlyIso('2026-03-31')).toBe('2026-03-31');
  });

  it('normalizes timestamps to date-only ISO', () => {
    expect(extractDateOnlyIso('2026-03-31T23:59:59.999Z')).toBe('2026-03-31');
  });

  it('rejects impossible calendar dates', () => {
    expect(() => extractDateOnlyIso('2026-02-30')).toThrow(BadRequestException);
  });

  it('stores LocalDate values at stable midday UTC', () => {
    expect(parseDateOnlyToStoredUtcDate('2026-03-31').toISOString()).toBe('2026-03-31T12:00:00.000Z');
  });

  it('computes the start of the UTC day for range filters', () => {
    expect(startOfUtcDay('2026-03-31').toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });

  it('maps Date references to the configured app timezone instead of raw UTC', () => {
    expect(extractDateOnlyIso(new Date('2026-04-01T01:30:00.000Z'))).toBe('2026-03-31');
    expect(todayLocalDateOnly(new Date('2026-04-01T01:30:00.000Z'))).toBe('2026-03-31');
  });

  it('compares date-only values against today in the configured app timezone', () => {
    expect(isDateOnlyBeforeToday('2026-03-30', new Date('2026-03-31T23:00:00.000Z'))).toBe(true);
    expect(isDateOnlyBeforeToday('2026-03-31', new Date('2026-04-01T01:30:00.000Z'))).toBe(false);
  });

  it('rejects invalid configured timezones early', () => {
    process.env.APP_TIME_ZONE = 'Mars/Olympus_Mons';

    expect(() => todayLocalDateOnly(new Date('2026-03-31T12:00:00.000Z'))).toThrow('APP_TIME_ZONE invalida');
  });
});
