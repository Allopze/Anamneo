import { parseHistoryField, getFirstName, getNameInitial } from '@/lib/utils';

describe('parseHistoryField', () => {
  it('parses a JSON string into object', () => {
    expect(parseHistoryField('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('wraps non-JSON string in texto field', () => {
    expect(parseHistoryField('plain text')).toEqual({ texto: 'plain text' });
  });

  it('returns object as-is', () => {
    const obj = { a: 1 };
    expect(parseHistoryField(obj)).toBe(obj);
  });

  it('returns null/undefined as-is', () => {
    expect(parseHistoryField(null)).toBeNull();
    expect(parseHistoryField(undefined)).toBeUndefined();
  });

  it('returns arrays as-is', () => {
    const arr = [1, 2];
    expect(parseHistoryField(arr)).toBe(arr);
  });
});

describe('getFirstName', () => {
  it('returns first name from full name', () => {
    expect(getFirstName('Juan Pérez')).toBe('Juan');
  });

  it('skips Dr. title', () => {
    expect(getFirstName('Dr. Carlos López')).toBe('Carlos');
  });

  it('skips Dra. title', () => {
    expect(getFirstName('Dra. María González')).toBe('María');
  });

  it('skips multiple titles', () => {
    expect(getFirstName('Dr. Prof. Roberto Silva')).toBe('Roberto');
  });

  it('returns empty for null/undefined', () => {
    expect(getFirstName(null)).toBe('');
    expect(getFirstName(undefined)).toBe('');
    expect(getFirstName('')).toBe('');
  });

  it('handles single word name', () => {
    expect(getFirstName('Ana')).toBe('Ana');
  });

  it('falls back to first part if all are titles', () => {
    expect(getFirstName('Dr.')).toBe('Dr.');
  });
});

describe('getNameInitial', () => {
  it('returns first letter uppercase', () => {
    expect(getNameInitial('juan pérez')).toBe('J');
  });

  it('skips title and uses real name initial', () => {
    expect(getNameInitial('Dr. carlos')).toBe('C');
  });

  it('returns empty for falsy input', () => {
    expect(getNameInitial(null)).toBe('');
  });
});
