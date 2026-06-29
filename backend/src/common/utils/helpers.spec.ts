import { validateRut } from './helpers';

describe('validateRut', () => {
  it('should validate a canonical RUT format', () => {
    expect(validateRut('1-9')).toEqual({ valid: true, formatted: '1-9' });
  });

  it('should allow spaces around separators', () => {
    expect(validateRut(' 1 - 9 ')).toEqual({ valid: true, formatted: '1-9' });
  });

  it('should reject invalid check digits', () => {
    expect(validateRut('1-8')).toEqual({ valid: false, formatted: null });
  });
});
