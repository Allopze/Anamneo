/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const {
  resolveSqliteDatabasePath,
  resolveBackupDir,
  listBackupFiles,
  readFirstColumn,
  toPrismaFileUrl,
} = require('./sqlite-utils');

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

async function runIntegrityCheck(drillDbPath) {
  const client = new PrismaClient({
    datasources: {
      db: { url: toPrismaFileUrl(drillDbPath) },
    },
  });

  try {
    await client.$connect();
    const integrityRows = await client.$queryRawUnsafe('PRAGMA integrity_check;');
    const integrityValue = readFirstColumn(integrityRows);

    if (String(integrityValue || '').toLowerCase() !== 'ok') {
      throw new Error(`Integrity check fallo: ${integrityValue}`);
    }

    await client.$queryRawUnsafe('SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type = "table";');
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const dbPath = resolveSqliteDatabasePath(process.env.DATABASE_URL);
  const backupDir = resolveBackupDir(dbPath, process.env.SQLITE_BACKUP_DIR);
  const fromArg = readArg('from');

  const sourceBackupPath = fromArg
    ? path.isAbsolute(fromArg)
      ? fromArg
      : path.resolve(process.cwd(), fromArg)
    : (() => {
      const latestBackup = listBackupFiles(backupDir)[0];
      if (!latestBackup) {
        throw new Error(`No se encontraron backups .db en ${backupDir}`);
      }
      return latestBackup.path;
    })();

  if (!fs.existsSync(sourceBackupPath)) {
    throw new Error(`Backup no encontrado: ${sourceBackupPath}`);
  }

  const drillDir = path.join(backupDir, 'restore-drills');
  fs.mkdirSync(drillDir, { recursive: true });

  const drillDbPath = path.join(drillDir, `restore-drill-${Date.now()}.db`);
  const startedAt = Date.now();

  try {
    fs.copyFileSync(sourceBackupPath, drillDbPath);
    await runIntegrityCheck(drillDbPath);

    const durationMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      event: 'sqlite_restore_drill_passed',
      sourceBackupPath,
      drillDbPath,
      durationMs,
    }));
  } finally {
    fs.rmSync(drillDbPath, { force: true });
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'sqlite_restore_drill_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
