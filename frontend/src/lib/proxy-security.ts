export function resolveSentryOrigin(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;

  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, isProd: boolean): string {
  const strictCspEnabled = process.env.NEXT_PUBLIC_STRICT_CSP === 'true';
  const scriptSrc = isProd
    ? strictCspEnabled
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'unsafe-inline'`
    : `'self' 'unsafe-inline' 'unsafe-eval'`;
  const sentryOrigin = resolveSentryOrigin();
  const connectSrc = [`'self'`, ...(sentryOrigin ? [sentryOrigin] : [])].join(' ');

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob:`,
    `connect-src ${connectSrc}`,
    `font-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export function buildPermissionsPolicy(): string {
  const microphonePolicy = process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION === 'false'
    ? 'microphone=()'
    : 'microphone=(self)';

  return ['camera=()', microphonePolicy, 'geolocation=()'].join(', ');
}
