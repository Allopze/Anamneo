import { resolveProxyDecision, shouldValidateSessionRemotely } from '@/lib/proxy-session';

describe('shouldValidateSessionRemotely', () => {
  it('validates public auth routes remotely', () => {
    expect(shouldValidateSessionRemotely('/login')).toBe(true);
    expect(shouldValidateSessionRemotely('/register')).toBe(true);
  });

  it('skips remote validation for protected routes', () => {
    expect(shouldValidateSessionRemotely('/')).toBe(false);
    expect(shouldValidateSessionRemotely('/pacientes')).toBe(false);
  });
});

describe('resolveProxyDecision', () => {
  it('redirects protected routes without session cookies', () => {
    expect(
      resolveProxyDecision({
        pathname: '/pacientes',
        search: '',
        hasSessionCookie: false,
        hasRefreshToken: false,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'redirect', target: '/login?from=%2Fpacientes' });
  });

  it('redirects public routes only when the session is validated', () => {
    expect(
      resolveProxyDecision({
        pathname: '/login',
        search: '',
        hasSessionCookie: true,
        hasRefreshToken: false,
        hasValidatedSession: true,
      }),
    ).toEqual({ action: 'redirect', target: '/' });
  });

  it('allows protected routes with only a refresh token so the shell can recover the session', () => {
    expect(
      resolveProxyDecision({
        pathname: '/atenciones',
        search: '',
        hasSessionCookie: true,
        hasRefreshToken: true,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'next' });
  });

  it('redirects protected routes when access validation fails and there is no refresh token', () => {
    expect(
      resolveProxyDecision({
        pathname: '/pacientes/123',
        search: '?tab=admin',
        hasSessionCookie: true,
        hasRefreshToken: false,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'redirect', target: '/login?from=%2Fpacientes%2F123%3Ftab%3Dadmin' });
  });
});