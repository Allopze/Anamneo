import { buildLoginRedirectPath } from './login-redirect';

export function shouldValidateSessionRemotely(pathname: string): boolean {
  return false;
}

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
  const isPublicRoute = pathname === '/login' || pathname === '/register';

  if (isPublicRoute) {
    if (hasSessionCookie) {
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