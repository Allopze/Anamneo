import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context';

type RequestWithRequestId = Request & { requestId?: string };

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
      path: req.originalUrl,
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
