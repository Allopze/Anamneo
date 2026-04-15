/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const {
  resolveDatabaseUrl,
  resolveSqliteDatabasePath,
  resolveBackupDir,
  resolveUploadsRoot,
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

function readBackupMetadata(backupPath) {
  const metadataPath = `${backupPath}.meta.json`;
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    return null;
  }
}

function collectDirectoryStats(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return {
      fileCount: 0,
      directoryCount: 0,
      totalSizeBytes: 0,
    };
  }

  let fileCount = 0;
  let directoryCount = 0;
  let totalSizeBytes = 0;

  const walk = (currentPath) => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        directoryCount += 1;
        walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      fileCount += 1;
      totalSizeBytes += fs.statSync(entryPath).size;
    }
  };

  walk(directoryPath);

  return {
    fileCount,
    directoryCount,
    totalSizeBytes,
  };
}

function findLatestUploadsSnapshot(backupDir) {
  const uploadsDir = path.join(backupDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) return null;

  const entries = fs.readdirSync(uploadsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('anamneo-'))
    .map(e => ({ name: e.name, path: path.join(uploadsDir, e.name) }))
    .sort((a, b) => b.name.localeCompare(a.name));

  return entries.length > 0 ? entries[0].path : null;
}

function createUploadsSnapshot(uploadsRoot, backupDir, timestamp) {
  const snapshotRelativePath = path.join('uploads', `anamneo-${timestamp}`);
  const snapshotPath = path.join(backupDir, snapshotRelativePath);
  const previousSnapshot = findLatestUploadsSnapshot(backupDir);

  fs.rmSync(snapshotPath, { recursive: true, force: true });
  fs.mkdirSync(snapshotPath, { recursive: true });

  let copiedFiles = 0;
  let linkedFiles = 0;

  if (fs.existsSync(uploadsRoot)) {
    const walk = (relDir) => {
      const srcDir = path.join(uploadsRoot, relDir);
      const dstDir = path.join(snapshotPath, relDir);
      const prevDir = previousSnapshot ? path.join(previousSnapshot, relDir) : null;

      if (relDir) fs.mkdirSync(dstDir, { recursive: true });

      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const relPath = path.join(relDir, entry.name);
        if (entry.isDirectory()) {
          walk(relPath);
          continue;
        }
        if (!entry.isFile()) continue;

        const srcPath = path.join(uploadsRoot, relPath);
        const dstPath = path.join(snapshotPath, relPath);
        const prevPath = prevDir ? path.join(prevDir, entry.name) : null;

        // Try hardlink from previous snapshot if file unchanged (same size + mtime)
        if (prevPath && fs.existsSync(prevPath)) {
          try {
            const srcStat = fs.statSync(srcPath);
            const prevStat = fs.statSync(prevPath);
            if (srcStat.size === prevStat.size && srcStat.mtimeMs === prevStat.mtimeMs) {
              fs.linkSync(prevPath, dstPath);
              linkedFiles++;
              continue;
            }
          } catch {
            // Fall through to copy
          }
        }

        fs.copyFileSync(srcPath, dstPath);
        copiedFiles++;
      }
    };
    walk('');
  }

  return {
    snapshotRelativePath,
    snapshotPath,
    copiedFiles,
    linkedFiles,
    ...collectDirectoryStats(snapshotPath),
  };
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
    const metadata = readBackupMetadata(file.path);
    if (metadata?.uploadsSnapshotRelativePath) {
      fs.rmSync(path.join(backupDir, metadata.uploadsSnapshotRelativePath), {
        recursive: true,
        force: true,
      });
    }
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
  const uploadsRoot = resolveUploadsRoot(process.env.UPLOAD_DEST);

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
    const uploadsSnapshot = createUploadsSnapshot(uploadsRoot, backupDir, timestamp);

    fs.writeFileSync(
      `${backupPath}.meta.json`,
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        sourceDatabase: dbPath,
        backupFile: backupFileName,
        sizeBytes: stat.size,
        checksumSha256,
        uploadsRoot,
        uploadsSnapshotRelativePath: uploadsSnapshot.snapshotRelativePath,
        uploadsFileCount: uploadsSnapshot.fileCount,
        uploadsDirectoryCount: uploadsSnapshot.directoryCount,
        uploadsTotalSizeBytes: uploadsSnapshot.totalSizeBytes,
        uploadsCopiedFiles: uploadsSnapshot.copiedFiles,
        uploadsLinkedFiles: uploadsSnapshot.linkedFiles,
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
      uploadsRoot,
      uploadsSnapshotPath: uploadsSnapshot.snapshotPath,
      uploadsFileCount: uploadsSnapshot.fileCount,
      uploadsCopiedFiles: uploadsSnapshot.copiedFiles,
      uploadsLinkedFiles: uploadsSnapshot.linkedFiles,
      uploadsTotalSizeBytes: uploadsSnapshot.totalSizeBytes,
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
