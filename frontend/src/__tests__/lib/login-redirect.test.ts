import {
  buildLoginRedirectPath,
  getCurrentAppPath,
  sanitizeRedirectPath,
} from '@/lib/login-redirect';

describe('login redirect helpers', () => {
  it('preserves path, search and hash from the current location', () => {
    expect(getCurrentAppPath({
      pathname: '/atenciones/enc-1',
      search: '?panel=review',
      hash: '#draft',
    })).toBe('/atenciones/enc-1?panel=review#draft');
  });

  it('builds a login redirect with a safe from parameter', () => {
    expect(buildLoginRedirectPath('/atenciones/enc-1?panel=review')).toBe(
      '/login?from=%2Fatenciones%2Fenc-1%3Fpanel%3Dreview',
    );
  });

  it('falls back when the redirect target is unsafe', () => {
    expect(sanitizeRedirectPath('//evil.test', '/pacientes')).toBe('/pacientes');
    expect(buildLoginRedirectPath('/login')).toBe('/login');
  });
});