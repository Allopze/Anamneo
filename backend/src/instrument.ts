import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

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

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  integrations: [nodeProfilingIntegration()],
  enableLogs: !isProduction,
  tracesSampleRate: isProduction ? 0.05 : 0.2,
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

    return event;
  },
});
