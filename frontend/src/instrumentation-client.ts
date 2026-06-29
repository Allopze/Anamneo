import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';
const allowReplay = !isProduction && process.env.NEXT_PUBLIC_SENTRY_REPLAY_ENABLED === 'true';

const PHI_REDACTIONS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g, replacement: '[RUT]' },
  { pattern: /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, replacement: '[EMAIL]' },
  { pattern: /\b\d{8,}\b/g, replacement: '[DIGITS]' },
  {
    pattern: /"(smtpPassword|password|currentPassword|newPassword|passwordHash|totpCode|totpSecret|token|refreshToken|accessToken|tokenHash|csrf_token|csrfToken|recoveryCode)"\s*:\s*"[^"]*"/gi,
    replacement: '"$1":"[REDACTED]"',
  },
];

function scrubText(value: string | undefined): string | undefined {
  if (!value) return value;
  let result = value;
  for (const { pattern, replacement } of PHI_REDACTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function scrubClinicalEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  delete event.user;
  delete event.extra;
  delete event.contexts;
  delete event.breadcrumbs;

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;

    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
      delete event.request.headers.cookie;
      delete event.request.headers.Cookie;
      delete event.request.headers['x-forwarded-for'];
      delete event.request.headers['X-Forwarded-For'];
    }
  }

  if (event.message) {
    event.message = scrubText(event.message);
  }

  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = scrubText(exception.value);
      }
    }
  }

  return event;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: allowReplay ? 1.0 : 0,
    beforeSend: scrubClinicalEvent,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
