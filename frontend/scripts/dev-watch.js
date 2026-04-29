#!/usr/bin/env node

const path = require('node:path');
const { spawn } = require('node:child_process');
const { installProcessGuard } = require('../../scripts/dev-process-guard');

const frontendRoot = path.resolve(__dirname, '..');
const nextBin = path.join(frontendRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '5556';

let serverProcess = null;
let isStopping = false;

function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill('SIGTERM');
}

function shutdown(code = 0) {
  if (isStopping) {
    return;
  }

  isStopping = true;
  stopChild(serverProcess);

  const maybeExit = () => process.exit(code);
  if (serverProcess && serverProcess.exitCode === null && !serverProcess.killed) {
    serverProcess.once('exit', maybeExit);
    return;
  }

  maybeExit();
}

installProcessGuard({
  onParentGone(reason) {
    if (isStopping) {
      return;
    }

    console.error(`[frontend-dev-watch] ${reason}. Stopping Next.js dev server...`);
    shutdown(0);
  },
});

serverProcess = spawn(
  process.execPath,
  [nextBin, 'dev', ...process.argv.slice(2), '-H', host, '-p', port],
  {
    cwd: frontendRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

serverProcess.on('exit', (code, signal) => {
  if (isStopping) {
    return;
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(0));
}
