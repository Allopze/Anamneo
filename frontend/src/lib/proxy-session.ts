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
  hasPatientSessionCookie?: boolean;
  hasPatientRefreshToken?: boolean;
  hasValidatedPatientSession?: boolean;
}): ProxyDecision {
  const {
    pathname,
    search,
    hasSessionCookie,
    hasRefreshToken,
    hasValidatedSession,
    hasPatientSessionCookie,
    hasPatientRefreshToken,
    hasValidatedPatientSession,
  } = input;
  const isLegalRoute = pathname === '/terminos-y-condiciones' || pathname === '/politica-de-privacidad';
  const isDataRightsRoute = pathname === '/derechos' || pathname === '/descargar-ficha';
  const isPortalPublicRoute = pathname === '/portal/login' || pathname === '/portal/activar';
  const isPortalRoute = pathname === '/portal' || pathname.startsWith('/portal/');
  const isAuthRoute = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  const isPasswordResetWithToken = pathname === '/cambiar-contrasena' && /[?&]token=/.test(search);
  const isPublicRoute = isAuthRoute || isLegalRoute || isDataRightsRoute || isPortalPublicRoute || isPasswordResetWithToken;

  if (isPortalRoute && !isPortalPublicRoute) {
    if (hasValidatedPatientSession || hasPatientRefreshToken) {
      return { action: 'next' };
    }
    if (!hasPatientSessionCookie) {
      return { action: 'redirect', target: `/portal/login?next=${encodeURIComponent(`${pathname}${search}`)}` };
    }
  }

  if (isPublicRoute) {
    if (isPortalPublicRoute && hasValidatedPatientSession) {
      return { action: 'redirect', target: '/portal' };
    }

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
