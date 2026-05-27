#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process');

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !(databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://'))) {
  console.error('TEST_DATABASE_URL must point to a PostgreSQL database for audit concurrency validation.');
  process.exit(1);
}

const url = new URL(databaseUrl);
const env = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(url.password),
};
const psqlArgs = [
  `--host=${url.hostname}`,
  `--port=${url.port || '5432'}`,
  `--username=${decodeURIComponent(url.username)}`,
  '--dbname=postgres',
  '--command=SELECT 1',
];

try {
  execFileSync('psql', psqlArgs, { stdio: 'pipe', env });
  execFileSync('createdb', ['--version'], { stdio: 'pipe' });
  execFileSync('dropdb', ['--version'], { stdio: 'pipe' });
} catch (error) {
  console.error('PostgreSQL CLI tools psql, createdb and dropdb must be installed and able to reach TEST_DATABASE_URL.');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['jest', '--runInBand', 'audit.service.concurrency.spec.ts'],
  { stdio: 'inherit', env },
);

process.exit(result.status ?? 1);
