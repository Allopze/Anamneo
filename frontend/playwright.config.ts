import { defineConfig, devices } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'path';

const backendRoot = path.resolve(__dirname, '../backend');
const e2eRunId = process.env.PLAYWRIGHT_E2E_RUN_ID || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// Keep uploads and DB inside backend/ so backend upload-root guard stays active in E2E.
const e2eWorkspace = path.join(backendRoot, '.playwright-e2e', e2eRunId);
fs.mkdirSync(e2eWorkspace, { recursive: true });

const testDbName = `anamneo_playwright_${e2eRunId.replace(/[^a-zA-Z0-9_]/g, '_')}`;

// Read DB credentials from backend/.env so we don't hardcode them here.
// Override entirely with PLAYWRIGHT_DATABASE_URL if needed.
function resolveTestDbUrl(): string {
  if (process.env.PLAYWRIGHT_DATABASE_URL) return process.env.PLAYWRIGHT_DATABASE_URL;
  let dbUser = process.env.PLAYWRIGHT_DB_USER || 'postgres';
  let dbPassword = process.env.PLAYWRIGHT_DB_PASSWORD || 'postgres';
  const backendEnvPath = path.resolve(__dirname, '../backend/.env');
  if (fs.existsSync(backendEnvPath)) {
    const content = fs.readFileSync(backendEnvPath, 'utf-8');
    const m = content.match(/^DATABASE_URL\s*=\s*["']?(postgresql:\/\/[^?\s"'\r\n]+)/m);
    if (m) {
      try {
        const u = new URL(m[1]);
        if (u.username) dbUser = decodeURIComponent(u.username);
        if (u.password) dbPassword = decodeURIComponent(u.password);
      } catch { /* keep defaults */ }
    }
  }
  return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@localhost:5432/${testDbName}?schema=public`;
}
const testDbUrl = resolveTestDbUrl();
const testUploadDir = path.join(e2eWorkspace, 'uploads');
const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '5556';
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || '5679';
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
      timeout: 300000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: testDbUrl,
        MIGRATION_DATABASE_URL: testDbUrl,
        JWT_SECRET: 'e2e-jwt-secret-for-testing-only',
        JWT_REFRESH_SECRET: 'e2e-jwt-refresh-secret-for-testing-only',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        BACKEND_PORT: backendPort,
        PORT: backendPort,
        CORS_ORIGIN: baseURL,
        TRUST_PROXY: '0',
        UPLOAD_DEST: testUploadDir,
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
      timeout: 300000,
      env: {
        ...process.env,
        API_PROXY_TARGET: apiProxyTarget,
        NEXT_PUBLIC_API_URL: '/api',
        NEXT_PUBLIC_DEFAULT_SHARED_DEVICE_MODE: 'false',
        NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE: 'false',
        HOSTNAME: host,
        PORT: frontendPort,
      },
    },
  ],
});
