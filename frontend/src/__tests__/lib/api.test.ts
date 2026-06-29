import { shouldSkipRefresh } from '@/lib/api';

describe('api refresh exclusions', () => {
  it('skips refresh for 2FA verification during login', () => {
    expect(shouldSkipRefresh('/auth/2fa/verify')).toBe(true);
  });

  it('keeps refresh enabled for protected clinical endpoints', () => {
    expect(shouldSkipRefresh('/patients/patient-1')).toBe(false);
  });
});