import { resolveProxyDecision } from '@/lib/proxy-session';
import { buildCsp, buildPermissionsPolicy, resolveSentryOrigin } from '@/lib/proxy-security';

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

  it('keeps legal routes public even when a valid session exists', () => {
    expect(
      resolveProxyDecision({
        pathname: '/politica-de-privacidad',
        search: '',
        hasSessionCookie: true,
        hasRefreshToken: true,
        hasValidatedSession: true,
      }),
    ).toEqual({ action: 'next' });

    expect(
      resolveProxyDecision({
        pathname: '/terminos-y-condiciones',
        search: '',
        hasSessionCookie: false,
        hasRefreshToken: false,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'next' });
  });

  it('keeps data-subject routes public without internal session cookies', () => {
    expect(
      resolveProxyDecision({
        pathname: '/derechos',
        search: '',
        hasSessionCookie: false,
        hasRefreshToken: false,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'next' });

    expect(
      resolveProxyDecision({
        pathname: '/descargar-ficha',
        search: '?token=abc',
        hasSessionCookie: false,
        hasRefreshToken: false,
        hasValidatedSession: false,
      }),
    ).toEqual({ action: 'next' });
  });

  it('uses patient portal cookies for portal routes', () => {
    expect(
      resolveProxyDecision({
        pathname: '/portal',
        search: '',
        hasSessionCookie: false,
        hasRefreshToken: false,
        hasValidatedSession: false,
        hasPatientSessionCookie: false,
        hasPatientRefreshToken: false,
        hasValidatedPatientSession: false,
      }),
    ).toEqual({ action: 'redirect', target: '/portal/login?next=%2Fportal' });

    expect(
      resolveProxyDecision({
        pathname: '/portal',
        search: '',
        hasSessionCookie: false,
        hasRefreshToken: false,
        hasValidatedSession: false,
        hasPatientSessionCookie: true,
        hasPatientRefreshToken: true,
        hasValidatedPatientSession: false,
      }),
    ).toEqual({ action: 'next' });
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

describe('proxy security headers', () => {
  const originalSentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const originalVoiceFlag = process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION;
  const originalStrictCsp = process.env.NEXT_PUBLIC_STRICT_CSP;

  afterEach(() => {
    if (originalSentryDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = originalSentryDsn;

    if (originalVoiceFlag === undefined) delete process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION;
    else process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION = originalVoiceFlag;

    if (originalStrictCsp === undefined) delete process.env.NEXT_PUBLIC_STRICT_CSP;
    else process.env.NEXT_PUBLIC_STRICT_CSP = originalStrictCsp;
  });

  it('adds the Sentry DSN origin to connect-src when configured', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc123@o999999.ingest.sentry.io/1234567';

    expect(resolveSentryOrigin()).toBe('https://o999999.ingest.sentry.io');
    expect(buildCsp('nonce-test', true)).toContain("connect-src 'self' https://o999999.ingest.sentry.io");
  });

  it('allows Next App Router inline bootstrap scripts on static pages', () => {
    delete process.env.NEXT_PUBLIC_STRICT_CSP;
    expect(buildCsp('nonce-test', true)).toContain("script-src 'self' 'unsafe-inline'");
  });

  it('keeps insecure request upgrades out of local development CSP', () => {
    expect(buildCsp('nonce-test', false)).not.toContain('upgrade-insecure-requests');
    expect(buildCsp('nonce-test', true)).toContain('upgrade-insecure-requests');
  });

  it('can emit strict nonce-based script policy for staging validation', () => {
    process.env.NEXT_PUBLIC_STRICT_CSP = 'true';
    const csp = buildCsp('nonce-test', true);

    expect(csp).toContain("script-src 'self' 'nonce-nonce-test' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('keeps microphone enabled for self unless voice dictation is explicitly disabled', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION;
    expect(buildPermissionsPolicy()).toContain('microphone=(self)');

    process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION = 'false';
    expect(buildPermissionsPolicy()).toContain('microphone=()');
  });
});
