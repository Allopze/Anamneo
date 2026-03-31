import { BadRequestException } from '@nestjs/common';
import {
  extractDateOnlyIso,
  isDateOnlyBeforeToday,
  parseDateOnlyToStoredUtcDate,
  startOfUtcDay,
} from './local-date';

describe('local-date', () => {
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

  it('compares date-only values without depending on local timezone offsets', () => {
    expect(isDateOnlyBeforeToday('2026-03-30', new Date('2026-03-31T23:00:00.000Z'))).toBe(true);
    expect(isDateOnlyBeforeToday('2026-03-31', new Date('2026-03-31T01:00:00.000Z'))).toBe(false);
  });
});
