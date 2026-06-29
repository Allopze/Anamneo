# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/tests/e2e/audit-capture.spec.ts >> Audit — edge cases & console/network evidence >> audit: login-error
- Location: frontend/tests/e2e/audit-capture.spec.ts:220:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5556/login
Call log:
  - navigating to "http://127.0.0.1:5556/login", waiting until "load"

```

# Test source

```ts
  1  | import type { Page, TestInfo } from '@playwright/test';
  2  | 
  3  | function resolveBaseURL(testInfo?: TestInfo) {
  4  |   const configured = testInfo?.project.use.baseURL;
  5  |   if (typeof configured === 'string' && configured.trim()) {
  6  |     return configured;
  7  |   }
  8  | 
  9  |   const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
  10 |   const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '5556';
  11 |   return process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${frontendPort}`;
  12 | }
  13 | 
  14 | export async function gotoApp(page: Page, path: string, testInfo?: TestInfo) {
  15 |   const baseURL = resolveBaseURL(testInfo);
  16 |   if (!baseURL && path.startsWith('/')) {
  17 |     throw new Error(
  18 |       `Playwright baseURL is required before navigating to ${path}. Run through frontend/playwright.config.ts.`,
  19 |     );
  20 |   }
  21 | 
> 22 |   return page.goto(path.startsWith('/') ? new URL(path, baseURL).toString() : path);
     |               ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5556/login
  23 | }
  24 | 
```