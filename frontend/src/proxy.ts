import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyDecision } from './lib/proxy-session';

const AUTH_ME_PATH = '/api/auth/me';

async function hasValidatedAccessSession(request: NextRequest): Promise<boolean> {
  if (!request.cookies.has('access_token')) {
    return false;
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }

  try {
    const response = await fetch(new URL(AUTH_ME_PATH, request.url), {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has('access_token');
  const hasRefreshToken = request.cookies.has('refresh_token');
  const hasSessionCookie = hasAccessToken || hasRefreshToken;
  const hasValidatedSession = await hasValidatedAccessSession(request);

  const decision = resolveProxyDecision({
    pathname,
    search: request.nextUrl.search,
    hasSessionCookie,
    hasRefreshToken,
    hasValidatedSession,
  });

  if (decision.action === 'next') {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(decision.target, request.url));
}

export const config = {
  matcher: [
    '/((?!api|_next|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?)$).*)',
  ],
};
