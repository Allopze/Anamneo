import { NextRequest, NextResponse } from 'next/server';
import { resolveProxyDecision } from './lib/proxy-session';

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
