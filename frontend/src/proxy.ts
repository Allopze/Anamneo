import { NextRequest, NextResponse } from 'next/server';
import { buildLoginRedirectPath } from './lib/login-redirect';

const publicRoutes = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSession =
    request.cookies.has('access_token') || request.cookies.has('refresh_token');

  const isPublicRoute = publicRoutes.some((route) => pathname === route);

  if (!isPublicRoute && !hasSession) {
    const loginUrl = new URL(buildLoginRedirectPath(`${pathname}${request.nextUrl.search}`), request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?)$).*)',
  ],
};
