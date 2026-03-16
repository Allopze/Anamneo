/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const {
  resolveDatabaseUrl,
  resolveSqliteDatabasePath,
  resolveBackupDir,
  escapeSqliteString,
  formatTimestamp,
  readPositiveInteger,
  readFirstColumn,
  toPrismaFileUrl,
  listBackupFiles,
} = require('./sqlite-utils');

const DEFAULT_RETENTION_DAYS = 14;

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function cleanupExpiredBackups(backupDir, retentionDays) {
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const files = listBackupFiles(backupDir);

  let removed = 0;
  for (const file of files) {
    if (now - file.mtime.getTime() <= maxAgeMs) {
      continue;
    }

    fs.rmSync(file.path, { force: true });
    fs.rmSync(`${file.path}.meta.json`, { force: true });
    removed += 1;
  }

  return removed;
}

async function verifyBackupIntegrity(backupPath) {
  const verifyClient = new PrismaClient({
    datasources: {
      db: { url: toPrismaFileUrl(backupPath) },
    },
  });

  try {
    await verifyClient.$connect();
    const rows = await verifyClient.$queryRawUnsafe('PRAGMA integrity_check;');
    const firstValue = readFirstColumn(rows);
    return typeof firstValue === 'string' ? firstValue.toLowerCase() === 'ok' : false;
  } finally {
    await verifyClient.$disconnect();
  }
}

async function main() {
  const retentionDays = readPositiveInteger(process.env.SQLITE_BACKUP_RETENTION_DAYS, DEFAULT_RETENTION_DAYS);
  const resolvedUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
  const dbPath = resolveSqliteDatabasePath(process.env.DATABASE_URL);
  const backupDir = resolveBackupDir(dbPath, process.env.SQLITE_BACKUP_DIR);

  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = formatTimestamp();
  const backupFileName = `anamneo-${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFileName);

  const prisma = new PrismaClient({
    datasources: {
      db: { url: resolvedUrl },
    },
  });

  const startedAt = Date.now();

  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(PASSIVE);');
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escapeSqliteString(backupPath)}';`);

    const isBackupValid = await verifyBackupIntegrity(backupPath);
    if (!isBackupValid) {
      fs.rmSync(backupPath, { force: true });
      throw new Error('La verificacion de integridad del backup fallo');
    }

    const checksumSha256 = sha256File(backupPath);
    const stat = fs.statSync(backupPath);

    fs.writeFileSync(
      `${backupPath}.meta.json`,
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        sourceDatabase: dbPath,
        backupFile: backupFileName,
        sizeBytes: stat.size,
        checksumSha256,
      }, null, 2)}\n`,
      'utf8',
    );

    const removedExpired = cleanupExpiredBackups(backupDir, retentionDays);
    const durationMs = Date.now() - startedAt;

    console.log(JSON.stringify({
      event: 'sqlite_backup_completed',
      backupFile: backupFileName,
      backupPath,
      sizeBytes: stat.size,
      checksumSha256,
      retentionDays,
      removedExpired,
      durationMs,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'sqlite_backup_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
