import type { NextFunction, Request, Response } from 'express';
import { buildRequestLogPath } from '../common/utils/request-tracing';
import { httpRequestsTotal, httpRequestDurationSecondsSum } from './metrics-registry';

const SKIP_PATHS = new Set(['/api/metrics', '/api/health']);

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const path = buildRequestLogPath(req);
    if (SKIP_PATHS.has(path)) return;
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestsTotal.inc({
      method: req.method,
      route: path,
      status: res.statusCode,
    });
    httpRequestDurationSecondsSum.inc({ route: path }, durationSeconds);
  });
  next();
}
