import * as Sentry from '@sentry/nestjs';
import type { Integration } from '@sentry/core';
import { scrubPhi } from './common/utils/phi-scrub';

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

function sanitizeHeaders(headers: Record<string, string> | undefined) {
  if (!headers) {
    return headers;
  }

  const nextHeaders: Record<string, string> = { ...headers };
  for (const key of Object.keys(nextHeaders)) {
    const normalized = key.toLowerCase();
    if (normalized === 'authorization' || normalized === 'cookie' || normalized === 'set-cookie') {
      nextHeaders[key] = '[REDACTED]';
    }
  }

  return nextHeaders;
}

const scrubText = scrubPhi;
const integrations: Integration[] = [];

if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const profiling = require('@sentry/profiling-node') as typeof import('@sentry/profiling-node');
    integrations.push(profiling.nodeProfilingIntegration());
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'sentry_profiling_integration_unavailable',
      message: scrubText((error as Error).message),
    }));
  }
}

function scrubExceptionValues(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (!event.exception?.values) return event;
  for (const exception of event.exception.values) {
    if (exception.value) {
      exception.value = scrubText(exception.value);
    }
  }
  return event;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  integrations,
  enableLogs: !isProduction,
  tracesSampleRate: isProduction ? 0.1 : 0.2,
  profileSessionSampleRate: 0,
  profileLifecycle: 'trace',
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.user) {
      delete event.user;
    }

    if (event.request) {
      event.request = {
        ...event.request,
        headers: sanitizeHeaders(event.request.headers as Record<string, string> | undefined),
        cookies: undefined,
        data: undefined,
      };
    }

    if (event.message) {
      event.message = scrubText(event.message);
    }

    return scrubExceptionValues(event);
  },
});
