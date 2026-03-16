/* eslint-disable no-console */

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const {
  resolveDatabaseUrl,
  resolveSqliteDatabasePath,
  resolveBackupDir,
  listBackupFiles,
  readFirstColumn,
  readPositiveInteger,
} = require('./sqlite-utils');

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

async function main() {
  const maxBackupAgeHours = readPositiveInteger(process.env.SQLITE_BACKUP_MAX_AGE_HOURS, 24);
  const walWarnSizeMb = readPositiveInteger(process.env.SQLITE_WAL_WARN_SIZE_MB, 128);
  const strict = process.argv.includes('--strict');

  const dbPath = resolveSqliteDatabasePath(process.env.DATABASE_URL);
  const backupDir = resolveBackupDir(dbPath, process.env.SQLITE_BACKUP_DIR);
  const walPath = `${dbPath}-wal`;

  const prisma = new PrismaClient({
    datasources: {
      db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) },
    },
  });

  const warnings = [];

  try {
    await prisma.$connect();

    const journalRows = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
    const synchronousRows = await prisma.$queryRawUnsafe('PRAGMA synchronous;');

    const journalMode = String(readFirstColumn(journalRows) || '').toUpperCase();
    const synchronous = String(readFirstColumn(synchronousRows) || '').toUpperCase();

    if (journalMode !== 'WAL') {
      warnings.push('journal_mode_is_not_wal');
    }
    if (synchronous === 'OFF') {
      warnings.push('synchronous_mode_is_off');
    }

    const walSizeBytes = fileSize(walPath);
    const walWarnThresholdBytes = walWarnSizeMb * 1024 * 1024;
    if (walSizeBytes !== null && walSizeBytes > walWarnThresholdBytes) {
      warnings.push('wal_size_above_threshold');
    }

    const latestBackup = listBackupFiles(backupDir)[0] || null;
    let latestBackupAgeHours = null;
    if (!latestBackup) {
      warnings.push('no_backup_found');
    } else {
      latestBackupAgeHours = Number(((Date.now() - latestBackup.mtime.getTime()) / (1000 * 60 * 60)).toFixed(2));
      if (latestBackupAgeHours > maxBackupAgeHours) {
        warnings.push('latest_backup_is_stale');
      }
    }

    const payload = {
      event: 'sqlite_monitor_status',
      status: warnings.length > 0 ? 'warn' : 'ok',
      databasePath: dbPath,
      databaseSizeBytes: fileSize(dbPath),
      walSizeBytes,
      walWarnThresholdBytes,
      backupDir,
      latestBackupFile: latestBackup ? latestBackup.name : null,
      latestBackupAgeHours,
      maxBackupAgeHours,
      warnings,
    };

    console.log(JSON.stringify(payload));

    if (strict && warnings.length > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'sqlite_monitor_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
