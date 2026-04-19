import { resolveProxyDecision } from '@/lib/proxy-session';

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

  it('keeps public routes accessible when only a stale session cookie remains', () => {
    expect(
      resolveProxyDecision({
        pathname: '/login',
        search: '',
        hasSessionCookie: true,
        hasRefreshToken: false,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'next' });
  });

  it('keeps public routes accessible when only a refresh token remains', () => {
    expect(
      resolveProxyDecision({
        pathname: '/login',
        search: '',
        hasSessionCookie: true,
        hasRefreshToken: true,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'next' });
  });

  it('redirects public routes only when an access token is already present', () => {
    expect(
      resolveProxyDecision({
        pathname: '/register',
        search: '',
        hasSessionCookie: true,
        hasRefreshToken: true,
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
