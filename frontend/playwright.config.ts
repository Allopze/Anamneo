import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const backendRoot = path.resolve(__dirname, '../backend');
const testDbPath = path.join(backendRoot, 'prisma', 'e2e-playwright.db');
const testDbUrl = `file:${testDbPath}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5555',
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
      port: 5678,
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: testDbUrl,
        ALLOW_SQLITE_IN_PRODUCTION: 'false',
        JWT_SECRET: 'e2e-jwt-secret-for-testing-only',
        JWT_REFRESH_SECRET: 'e2e-jwt-refresh-secret-for-testing-only',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        PORT: '5678',
        CORS_ORIGIN: 'http://127.0.0.1:5555',
        TRUST_PROXY: '0',
        UPLOAD_DEST: path.join(backendRoot, 'uploads-e2e'),
        SETTINGS_ENCRYPTION_KEY: 'e2e-settings-encryption-key-0123456789ab',
        APP_PUBLIC_URL: 'http://127.0.0.1:5555',
        BOOTSTRAP_TOKEN: 'e2e-bootstrap-token',
      },
    },
    {
      command: 'node scripts/e2e-webserver.js',
      cwd: __dirname,
      port: 5555,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        ...process.env,
        API_PROXY_TARGET: 'http://127.0.0.1:5678/api',
        E2E_DISABLE_PROXY_AUTH: 'true',
        HOSTNAME: '127.0.0.1',
        PORT: '5555',
      },
    },
  ],
}); 
