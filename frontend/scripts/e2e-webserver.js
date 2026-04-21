#!/usr/bin/env node

const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const frontendRoot = path.resolve(__dirname, '..');
const standaloneRoot = path.join(frontendRoot, '.next', 'standalone', 'frontend');
const standaloneServerEntry = path.join(standaloneRoot, 'server.js');
const standaloneStaticDir = path.join(standaloneRoot, '.next', 'static');
const builtStaticDir = path.join(frontendRoot, '.next', 'static');
const standalonePublicDir = path.join(standaloneRoot, 'public');
const publicDir = path.join(frontendRoot, 'public');

process.env.NODE_ENV = 'production';
process.env.HOSTNAME = process.env.HOSTNAME || '127.0.0.1';
process.env.PORT = process.env.PORT || '5555';

function runOrThrow(command, args) {
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildFrontend() {
  console.log('[frontend-e2e-webserver] Building frontend for Playwright...');
  runOrThrow('npm', ['run', 'build']);
}

function syncStandaloneAssets() {
  rmSync(standaloneStaticDir, { recursive: true, force: true });
  mkdirSync(path.dirname(standaloneStaticDir), { recursive: true });
  cpSync(builtStaticDir, standaloneStaticDir, { recursive: true });

  if (existsSync(publicDir)) {
    rmSync(standalonePublicDir, { recursive: true, force: true });
    cpSync(publicDir, standalonePublicDir, { recursive: true });
  }
}

function startFrontend() {
  const server = spawn(process.execPath, [standaloneServerEntry], {
    cwd: frontendRoot,
    env: process.env,
    stdio: 'inherit',
  });

  const killServer = (signal) => {
    if (server.killed) {
      return;
    }

    server.kill(signal);
    setTimeout(() => {
      if (!server.killed) {
        server.kill('SIGKILL');
      }
    }, 5000);
  };

  const handleExit = (signal) => {
    killServer(signal);
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => handleExit(signal));
  }

  process.on('exit', () => killServer('SIGTERM'));
  process.on('uncaughtException', (error) => {
    console.error('[frontend-e2e-webserver] Uncaught exception:', error);
    killServer('SIGTERM');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[frontend-e2e-webserver] Unhandled rejection:', reason);
    killServer('SIGTERM');
    process.exit(1);
  });

  server.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

buildFrontend();
syncStandaloneAssets();
startFrontend();