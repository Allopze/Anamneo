import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyDecision } from './lib/proxy-session';

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

function resolveSentryOrigin(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;

  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string, isProd: boolean): string {
  // Next extrae el nonce desde el CSP del request y lo aplica a sus estilos/scripts inline.
  // Mantenemos 'self' para bundles externos de Next en el standalone de produccion.
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}'`
    : `'self' 'nonce-${nonce}' 'unsafe-eval'`; // unsafe-eval solo en dev para Fast Refresh
  const sentryOrigin = resolveSentryOrigin();
  const connectSrc = [`'self'`, ...(sentryOrigin ? [sentryOrigin] : [])].join(' ');

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob:`,
    `connect-src ${connectSrc}`,
    `font-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

function buildPermissionsPolicy(): string {
  const microphonePolicy = process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION === 'false'
    ? 'microphone=()'
    : 'microphone=(self)';

  return ['camera=()', microphonePolicy, 'geolocation=()'].join(', ');
}

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production' && process.env.E2E_DISABLE_PROXY_AUTH === 'true') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has('access_token');
  const hasRefreshToken = request.cookies.has('refresh_token');
  const hasSessionCookie = hasAccessToken || hasRefreshToken;
  const hasPatientAccessToken = request.cookies.has('patient_access_token');
  const hasPatientRefreshToken = request.cookies.has('patient_refresh_token');
  const hasPatientSessionCookie = hasPatientAccessToken || hasPatientRefreshToken;

  const decision = resolveProxyDecision({
    pathname,
    search: request.nextUrl.search,
    hasSessionCookie,
    hasRefreshToken,
    hasValidatedSession: hasAccessToken,
    hasPatientSessionCookie,
    hasPatientRefreshToken,
    hasValidatedPatientSession: hasPatientAccessToken,
  });

  const nonce = generateNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'production');

  // Propaga el nonce al server tree y como header de respuesta CSP.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = decision.action === 'next'
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : NextResponse.redirect(new URL(decision.target, request.url));

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', buildPermissionsPolicy());

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?)$).*)',
  ],
};
