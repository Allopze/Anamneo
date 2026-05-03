import { extractDateOnly, formatDateOnly, toDateOnlyDisplayDate } from '@/lib/date';

describe('date-only helpers', () => {
  it('extracts YYYY-MM-DD from ISO timestamps', () => {
    expect(extractDateOnly('2026-03-31T00:00:00.000Z')).toBe('2026-03-31');
  });

  it('preserves date-only inputs', () => {
    expect(extractDateOnly('2026-03-31')).toBe('2026-03-31');
  });

  it('creates a stable local midday display date', () => {
    const displayDate = toDateOnlyDisplayDate('2026-03-31');

    expect(displayDate?.getFullYear()).toBe(2026);
    expect(displayDate?.getMonth()).toBe(2);
    expect(displayDate?.getDate()).toBe(31);
    expect(displayDate?.getHours()).toBe(12);
  });

  it('formats date-only values without shifting the calendar day', () => {
    expect(formatDateOnly('2026-03-31T00:00:00.000Z')).toBe('31 mar 2026');
    expect(formatDateOnly('2026-03-31', 'd MMM')).toBe('31 mar');
  });

  it('returns empty string for invalid values', () => {
    expect(formatDateOnly('nope')).toBe('');
  });
});
