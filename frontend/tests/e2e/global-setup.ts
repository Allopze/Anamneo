import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const BACKEND_ROOT = path.resolve(__dirname, '../../../backend');
const TEST_DB = path.join(BACKEND_ROOT, 'prisma', 'e2e-playwright.db');
const TEST_DB_URL = `file:./e2e-playwright.db`;

export default async function globalSetup() {
  // Clean previous test database
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = TEST_DB + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  // Apply migrations to create a fresh test database
  execSync('npx prisma migrate deploy', {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  });

  // Seed condition catalog
  execSync('npx ts-node prisma/seed.ts', {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  });

  console.log('[e2e-setup] Test database ready at', TEST_DB);
}
