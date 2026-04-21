import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const backendRoot = path.resolve(__dirname, '../backend');
const testDbPath = path.join(backendRoot, 'prisma', 'e2e-playwright.db');
const testDbUrl = `file:${testDbPath}`;
const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '5555';
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || '5678';
const baseURL = `http://${host}:${frontendPort}`;
const apiProxyTarget = `http://${host}:${backendPort}/api`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node scripts/e2e-webserver.js',
      cwd: backendRoot,
      port: Number(backendPort),
      reuseExistingServer,
      timeout: 30000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: testDbUrl,
        ALLOW_SQLITE_IN_PRODUCTION: 'false',
        JWT_SECRET: 'e2e-jwt-secret-for-testing-only',
        JWT_REFRESH_SECRET: 'e2e-jwt-refresh-secret-for-testing-only',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        PORT: backendPort,
        CORS_ORIGIN: baseURL,
        TRUST_PROXY: '0',
        UPLOAD_DEST: path.join(backendRoot, 'uploads-e2e'),
        SETTINGS_ENCRYPTION_KEY: 'e2e-settings-encryption-key-0123456789ab',
        APP_PUBLIC_URL: baseURL,
        BOOTSTRAP_TOKEN: 'e2e-bootstrap-token',
      },
    },
    {
      command: 'node scripts/e2e-webserver.js',
      cwd: __dirname,
      port: Number(frontendPort),
      reuseExistingServer,
      timeout: 120000,
      env: {
        ...process.env,
        API_PROXY_TARGET: apiProxyTarget,
        E2E_DISABLE_PROXY_AUTH: 'true',
        HOSTNAME: host,
        PORT: frontendPort,
      },
    },
  ],
});
