import { buildLoginRedirectPath } from './login-redirect';

export type ProxyDecision =
  | { action: 'next' }
  | { action: 'redirect'; target: string };

export function resolveProxyDecision(input: {
  pathname: string;
  search: string;
  hasSessionCookie: boolean;
  hasRefreshToken: boolean;
  hasValidatedSession: boolean;
}): ProxyDecision {
  const { pathname, search, hasSessionCookie, hasRefreshToken, hasValidatedSession } = input;
  const isLegalRoute = pathname === '/terminos-y-condiciones' || pathname === '/politica-de-privacidad';
  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const isPublicRoute = isAuthRoute || isLegalRoute;

  if (isPublicRoute) {
    if (isAuthRoute && hasValidatedSession) {
      return { action: 'redirect', target: '/' };
    }

    return { action: 'next' };
  }

  if (!hasSessionCookie) {
    return { action: 'redirect', target: buildLoginRedirectPath(`${pathname}${search}`) };
  }

  if (hasValidatedSession || hasRefreshToken) {
    return { action: 'next' };
  }

  return { action: 'redirect', target: buildLoginRedirectPath(`${pathname}${search}`) };
}
