import type { Page, TestInfo } from '@playwright/test';

function resolveBaseURL(testInfo?: TestInfo) {
  const configured = testInfo?.project.use.baseURL;
  if (typeof configured === 'string' && configured.trim()) {
    return configured;
  }

  const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
  const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '5556';
  return process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${frontendPort}`;
}

export async function gotoApp(page: Page, path: string, testInfo?: TestInfo) {
  const baseURL = resolveBaseURL(testInfo);
  if (!baseURL && path.startsWith('/')) {
    throw new Error(
      `Playwright baseURL is required before navigating to ${path}. Run through frontend/playwright.config.ts.`,
    );
  }

  return page.goto(path.startsWith('/') ? new URL(path, baseURL).toString() : path);
}
