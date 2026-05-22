import { ForbiddenException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Endpoints publicos donde NO se exige CSRF (sin sesion existente).
// Mantener al minimo. Cada uno debe estar protegido con throttling + validacion estricta.
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/2fa/verify',
  '/api/auth/forgot-password',
  '/api/auth/forgot-password/confirm',
]);

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Middleware de doble cookie CSRF.
 *
 * - En cada request, asegura que exista la cookie `csrf_token` (no httpOnly).
 * - En mutaciones (POST/PUT/PATCH/DELETE) fuera de la lista exenta, exige que
 *   el header `X-CSRF-Token` coincida con la cookie.
 *
 * El frontend lee la cookie via `document.cookie` y la inyecta como header en
 * el interceptor de axios.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  let token = cookies[CSRF_COOKIE];

  if (!token || typeof token !== 'string' || token.length < 16) {
    token = generateToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // debe ser legible por JS para el double-submit
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });
  }

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const path = req.originalUrl?.split('?')[0] ?? req.path;
  if (CSRF_EXEMPT_PATHS.has(path)) {
    return next();
  }

  const headerValue = req.headers[CSRF_HEADER];
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!header || typeof header !== 'string' || !safeEqual(header, token)) {
    return next(new ForbiddenException('CSRF token inválido o ausente'));
  }

  return next();
}

export const CSRF_TOKEN_COOKIE_NAME = CSRF_COOKIE;
export const CSRF_TOKEN_HEADER_NAME = CSRF_HEADER;
