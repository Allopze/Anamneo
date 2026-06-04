import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers/navigation';

test('frontend emits security headers compatible with active browser features', async ({ page }) => {
  const response = await gotoApp(page, '/login');
  expect(response).not.toBeNull();

  const headers = response!.headers();
  const csp = headers['content-security-policy'] ?? '';
  const permissionsPolicy = headers['permissions-policy'] ?? '';

  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(permissionsPolicy).toContain(
    process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION === 'false'
      ? 'microphone=()'
      : 'microphone=(self)',
  );

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const sentryOrigin = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin;
    expect(csp).toContain(sentryOrigin);
  }

  if (process.env.NEXT_PUBLIC_STRICT_CSP === 'true') {
    expect(csp).toContain("'strict-dynamic'");
    // Only script-src must be free of 'unsafe-inline'; style-src allows it by design
    // (inline style attributes cannot carry a nonce).
    const scriptSrc = csp.split('; ').find((directive) => directive.startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  }
});
