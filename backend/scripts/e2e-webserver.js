const { mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function resolveSqliteDatabasePath(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith('file:')) {
    throw new Error('DATABASE_URL must use file: for the Playwright E2E web server');
  }

  const rawPath = databaseUrl.slice('file:'.length);
  if (!rawPath) {
    throw new Error('DATABASE_URL must include a SQLite path for the Playwright E2E web server');
  }

  return path.normalize(path.isAbsolute(rawPath) ? rawPath : path.resolve(backendRoot, rawPath));
}

function resetFile(filePath) {
  rmSync(filePath, { force: true });
}

function resetDirectory(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  mkdirSync(dirPath, { recursive: true });
}

function runOrThrow(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function prepareTestDatabase() {
  const dbPath = resolveSqliteDatabasePath(process.env.DATABASE_URL);

  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    resetFile(`${dbPath}${suffix}`);
  }

  if (process.env.UPLOAD_DEST) {
    resetDirectory(process.env.UPLOAD_DEST);
  }

  runOrThrow(npxCommand, ['prisma', 'migrate', 'deploy']);
  runOrThrow(npxCommand, ['ts-node', 'prisma/seed.ts']);

  console.log(`[e2e-webserver] Test database ready at ${dbPath}`);
}

function startBackend() {
  const server = spawn(process.execPath, ['dist/src/main'], {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!server.killed) {
      server.kill(signal);
    }
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
startBackend();