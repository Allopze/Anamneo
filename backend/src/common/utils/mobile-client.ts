import type { Request } from 'express';

export const MOBILE_CLIENT_HEADER = 'x-client-type';
export const MOBILE_CLIENT_VALUE = 'mobile';

/**
 * Detects whether the incoming request originates from a native mobile client.
 *
 * Mobile clients (React Native / Flutter / iOS / Android nativo) no pueden
 * gestionar cookies httpOnly entregadas por el servidor, así que el flujo de
 * autenticación se adapta cuando se identifica este header.
 *
 * Efectos colaterales esperados cuando devuelve true:
 *  - CSRF middleware no exige `X-CSRF-Token` (el ataque CSRF requiere navegador
 *    enviando credenciales ambient; las apps nativas no envían cookies del SO).
 *  - Endpoints de auth (login/register/refresh/2fa) devuelven los tokens en el
 *    body además de setear cookies (que la app simplemente ignorará).
 *  - Refresh y logout aceptan el refresh token vía body `refreshToken` cuando
 *    la cookie no está disponible.
 */
export function isMobileClient(req: Request | undefined | null): boolean {
  if (!req) return false;
  const header = req.headers?.[MOBILE_CLIENT_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.toLowerCase() === MOBILE_CLIENT_VALUE;
}

/**
 * Extrae un Bearer token del header `Authorization`. Devuelve null si el header
 * está ausente o no tiene el formato esperado.
 */
export function extractBearerToken(req: Request | undefined | null): string | null {
  if (!req) return null;
  const header = req.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
