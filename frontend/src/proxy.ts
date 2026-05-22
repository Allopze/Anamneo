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

function buildCsp(nonce: string, isProd: boolean): string {
  // 'strict-dynamic' permite a scripts con nonce cargar dinamicos sin volver a listar dominios.
  // Sin nonces para styles porque Next/Tailwind 3 generan <style> inline para hydration sin nonce hook estable.
  // Mantenemos 'unsafe-inline' SOLO en style-src como compatibilidad hasta migrar a Next 17 con nonces estables;
  // pero quitamos 'unsafe-inline' de script-src (que es el vector real de XSS).
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'unsafe-eval'`; // unsafe-eval solo en dev para Fast Refresh

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `connect-src 'self'`,
    `font-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production' && process.env.E2E_DISABLE_PROXY_AUTH === 'true') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has('access_token');
  const hasRefreshToken = request.cookies.has('refresh_token');
  const hasSessionCookie = hasAccessToken || hasRefreshToken;

  const decision = resolveProxyDecision({
    pathname,
    search: request.nextUrl.search,
    hasSessionCookie,
    hasRefreshToken,
    hasValidatedSession: hasAccessToken,
  });

  const nonce = generateNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'production');

  // Propaga el nonce al server tree y como header de respuesta CSP.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = decision.action === 'next'
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : NextResponse.redirect(new URL(decision.target, request.url));

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?)$).*)',
  ],
};
