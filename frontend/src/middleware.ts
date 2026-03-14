import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth cookie (HttpOnly — presence check only)
  const hasSession = request.cookies.has('access_token') || request.cookies.has('refresh_token');

  const isPublicRoute = publicRoutes.some((route) => pathname === route);

  // Redirect unauthenticated users to login
  if (!isPublicRoute && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/register
  if (isPublicRoute && hasSession) {
    return NextResponse.redirect(new URL('/pacientes', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
