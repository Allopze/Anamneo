const { existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const backendEntryPoint = path.join(backendRoot, 'dist', 'backend', 'src', 'main.js');

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

function runAndCaptureOrThrow(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

function prepareTestDatabase() {
  const dbPath = resolveSqliteDatabasePath(process.env.DATABASE_URL);
  const schemaSqlPath = path.join(backendRoot, 'prisma', 'e2e-playwright-schema.sql');

  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    resetFile(`${dbPath}${suffix}`);
  }

  resetFile(schemaSqlPath);

  if (process.env.UPLOAD_DEST) {
    resetDirectory(process.env.UPLOAD_DEST);
  }

  const schemaSql = runAndCaptureOrThrow(npxCommand, [
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    './prisma/schema.prisma',
    '--script',
  ]);
  writeFileSync(schemaSqlPath, schemaSql, 'utf8');
  runOrThrow(npxCommand, ['prisma', 'db', 'execute', '--file', schemaSqlPath, '--schema', './prisma/schema.prisma']);
  runOrThrow(npxCommand, ['ts-node', 'prisma/seed.ts']);
  resetFile(schemaSqlPath);

  console.log(`[e2e-webserver] Test database ready at ${dbPath}`);
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
  const server = spawn(process.execPath, [backendEntryPoint], {
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
ensureBackendBuild();
startBackend();