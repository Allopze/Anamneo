import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';
const allowReplay = !isProduction && process.env.NEXT_PUBLIC_SENTRY_REPLAY_ENABLED === 'true';

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
