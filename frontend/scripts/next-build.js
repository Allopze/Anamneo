#!/usr/bin/env node

const { spawn } = require('node:child_process');

// Prevent shell-level NODE_ENV overrides from breaking Next production builds.
process.env.NODE_ENV = 'production';

const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
