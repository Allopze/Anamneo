import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context';

type RequestWithRequestId = Request & { requestId?: string };

const UUID_PATH_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATH_SEGMENT = /^[0-9a-f]{24}$/i;

function maskSensitivePathSegment(segment: string): string {
  if (UUID_PATH_SEGMENT.test(segment) || OBJECT_ID_PATH_SEGMENT.test(segment)) {
    return ':id';
  }

  return segment;
}

export function sanitizeRequestPath(pathOrUrl: string): string {
  const pathname = (() => {
    try {
      return new URL(pathOrUrl, 'http://localhost').pathname;
    } catch {
      return pathOrUrl.split('?')[0]?.split('#')[0] || '/';
    }
  })();

  const sanitizedPath = pathname
    .split('/')
    .map((segment) => maskSensitivePathSegment(segment))
    .join('/');

  return sanitizedPath || '/';
}

export function buildRequestLogPath(
  req: Pick<Request, 'originalUrl' | 'baseUrl'> & { route?: { path?: unknown } },
): string {
  const routePath = typeof req.route?.path === 'string' ? req.route.path : null;
  if (!routePath) {
    return sanitizeRequestPath(req.originalUrl);
  }

  const basePath = req.baseUrl && req.baseUrl !== '/' ? req.baseUrl : '';
  const normalizedRoutePath = routePath === '/' ? '' : routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${basePath}${normalizedRoutePath}` || '/';
}

export function requestTracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  const headerRequestId = req.headers['x-request-id'];
  const requestId = typeof headerRequestId === 'string' && headerRequestId.trim().length > 0
    ? headerRequestId.trim()
    : randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  const requestWithContext = req as RequestWithRequestId;
  requestWithContext.requestId = requestId;
  res.locals.requestId = requestId;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const logEntry = {
      level: res.statusCode >= 500 ? 'error' : 'info',
      event: 'http_request',
      requestId,
      method: req.method,
      path: buildRequestLogPath(req),
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    const serialized = JSON.stringify(logEntry);
    if (res.statusCode >= 500) {
      console.error(serialized);
      return;
    }

    console.log(serialized);
  });

  runWithRequestContext({ requestId }, () => next());
}
