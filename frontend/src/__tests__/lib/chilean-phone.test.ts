import {
  CHILEAN_PHONE_REGEX,
  normalizeChileanPhone,
  isValidChileanPhone,
} from '../../../../shared/chilean-phone';

describe('normalizeChileanPhone', () => {
  // Empty / whitespace → undefined (lets @IsOptional skip further validation)
  it('returns undefined for empty string', () => {
    expect(normalizeChileanPhone('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only', () => {
    expect(normalizeChileanPhone('   ')).toBeUndefined();
  });

  // Mobile numbers
  it('normalises mobile with +56 prefix and spaces', () => {
    expect(normalizeChileanPhone('+56 9 1234 5678')).toBe('+56912345678');
  });

  it('normalises mobile without country code', () => {
    expect(normalizeChileanPhone('9 1234 5678')).toBe('+56912345678');
  });

  it('normalises mobile without separators', () => {
    expect(normalizeChileanPhone('912345678')).toBe('+56912345678');
  });

  it('normalises mobile with hyphens', () => {
    expect(normalizeChileanPhone('9-1234-5678')).toBe('+56912345678');
  });

  it('normalises mobile with 56 prefix (no +)', () => {
    expect(normalizeChileanPhone('56 9 1234 5678')).toBe('+56912345678');
  });

  // Fixed lines
  it('normalises fixed line (Santiago 2X) with +56 prefix', () => {
    expect(normalizeChileanPhone('+56 2 2345 6789')).toBe('+56223456789');
  });

  it('normalises fixed line without country code', () => {
    expect(normalizeChileanPhone('2 2345 6789')).toBe('+56223456789');
  });

  it('normalises fixed line with 2-digit area code (e.g. Valparaíso 32)', () => {
    expect(normalizeChileanPhone('+56 32 123 4567')).toBe('+56321234567');
  });

  // Cannot normalise — returns trimmed original
  it('returns trimmed original for letters', () => {
    expect(normalizeChileanPhone('  abc  ')).toBe('abc');
  });

  it('returns trimmed original for too-short number', () => {
    expect(normalizeChileanPhone('1234')).toBe('1234');
  });
});

describe('CHILEAN_PHONE_REGEX', () => {
  it('matches canonical mobile', () => {
    expect(CHILEAN_PHONE_REGEX.test('+56912345678')).toBe(true);
  });

  it('matches canonical fixed (Santiago)', () => {
    expect(CHILEAN_PHONE_REGEX.test('+56223456789')).toBe(true);
  });

  it('does not match without +56 prefix', () => {
    expect(CHILEAN_PHONE_REGEX.test('912345678')).toBe(false);
  });

  it('does not match empty string', () => {
    expect(CHILEAN_PHONE_REGEX.test('')).toBe(false);
  });

  it('does not match number starting with 0', () => {
    expect(CHILEAN_PHONE_REGEX.test('+56012345678')).toBe(false);
  });

  it('does not match number starting with 1', () => {
    expect(CHILEAN_PHONE_REGEX.test('+56112345678')).toBe(false);
  });

  it('does not match too-short number', () => {
    expect(CHILEAN_PHONE_REGEX.test('+5691234')).toBe(false);
  });
});

describe('isValidChileanPhone', () => {
  // Empty / nullish → valid (optional field)
  it('returns true for empty string', () => {
    expect(isValidChileanPhone('')).toBe(true);
  });

  it('returns true for null', () => {
    expect(isValidChileanPhone(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isValidChileanPhone(undefined)).toBe(true);
  });

  it('returns true for whitespace', () => {
    expect(isValidChileanPhone('   ')).toBe(true);
  });

  // Valid formats
  it('returns true for +56 9 1234 5678 (mobile with spaces)', () => {
    expect(isValidChileanPhone('+56 9 1234 5678')).toBe(true);
  });

  it('returns true for 9 1234 5678 (mobile without country code)', () => {
    expect(isValidChileanPhone('9 1234 5678')).toBe(true);
  });

  it('returns true for +56 2 2345 6789 (fixed line)', () => {
    expect(isValidChileanPhone('+56 2 2345 6789')).toBe(true);
  });

  it('returns true for 22345 6789 (fixed line without code)', () => {
    expect(isValidChileanPhone('22345 6789')).toBe(true);
  });

  // Invalid
  it('returns false for letters', () => {
    expect(isValidChileanPhone('abc')).toBe(false);
  });

  it('returns false for too-short number', () => {
    expect(isValidChileanPhone('9 123 456')).toBe(false);
  });

  it('returns false for number starting with 0', () => {
    expect(isValidChileanPhone('0 1234 5678')).toBe(false);
  });
});
