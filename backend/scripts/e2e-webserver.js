/* eslint-disable no-console */

const { existsSync, mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const backendEntryPoint = path.join(backendRoot, 'dist', 'backend', 'src', 'main.js');

function resolveDatabaseUrl() {
  const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl || (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://'))) {
    throw new Error('PLAYWRIGHT_DATABASE_URL/DATABASE_URL must use postgresql:// for Playwright E2E');
  }
  return databaseUrl;
}

function parseDatabaseName(databaseUrl) {
  return new URL(databaseUrl).pathname.replace(/^\//, '');
}

function buildDatabaseUrlWithName(databaseUrl, databaseName) {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function buildMaintenanceDatabaseUrl(databaseUrl) {
  const url = new URL(buildDatabaseUrlWithName(databaseUrl, 'postgres'));
  url.searchParams.delete('schema');
  return url.toString();
}

function runOrThrow(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function prepareTestDatabase() {
  const databaseUrl = resolveDatabaseUrl();
  const databaseName = parseDatabaseName(databaseUrl);
  const maintenanceUrl = buildMaintenanceDatabaseUrl(databaseUrl);
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL || databaseUrl,
  };

  runOrThrow('dropdb', ['--if-exists', `--maintenance-db=${maintenanceUrl}`, databaseName], env);
  runOrThrow('createdb', [`--maintenance-db=${maintenanceUrl}`, databaseName], env);

  if (process.env.UPLOAD_DEST) {
    rmSync(process.env.UPLOAD_DEST, { recursive: true, force: true });
    mkdirSync(process.env.UPLOAD_DEST, { recursive: true });
  }

  runOrThrow(npxCommand, ['prisma', 'generate'], env);
  runOrThrow(npxCommand, ['prisma', 'migrate', 'deploy', '--schema', './prisma/schema.prisma'], env);
  runOrThrow(npxCommand, ['ts-node', 'prisma/seed.ts'], env);

  console.log(`[e2e-webserver] Test database ready: ${databaseName}`);
}

function ensureBackendBuild() {
  if (!existsSync(backendEntryPoint)) {
    console.log('[e2e-webserver] Backend build not found. Building Nest app first...');
  } else {
    console.log('[e2e-webserver] Rebuilding backend to keep Playwright E2E aligned with current source...');
  }
  runOrThrow('npm', ['run', 'build']);
}

function startBackend() {
  const databaseUrl = resolveDatabaseUrl();
  const server = spawn(process.execPath, [backendEntryPoint], {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL || databaseUrl,
    },
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!server.killed) server.kill(signal);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => forwardSignal(signal));
  }
  server.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

prepareTestDatabase();
ensureBackendBuild();
startBackend();
