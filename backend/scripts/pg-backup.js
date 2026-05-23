/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const {
  formatTimestamp,
  listBackupFiles,
  readPositiveInteger,
  resolveBackupDir,
  resolveDatabaseUrl,
  resolvePostgresToolUrl,
  resolveUploadsRoot,
} = require('./pg-utils');

const DEFAULT_RETENTION_DAYS = 14;

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function collectDirectoryStats(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return { fileCount: 0, directoryCount: 0, totalSizeBytes: 0 };
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
      } else if (entry.isFile()) {
        fileCount += 1;
        totalSizeBytes += fs.statSync(entryPath).size;
      }
    }
  };
  walk(directoryPath);
  return { fileCount, directoryCount, totalSizeBytes };
}

function findLatestUploadsSnapshot(backupDir) {
  const uploadsDir = path.join(backupDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) return null;
  const entries = fs.readdirSync(uploadsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('anamneo-'))
    .map((entry) => ({ name: entry.name, path: path.join(uploadsDir, entry.name) }))
    .sort((a, b) => b.name.localeCompare(a.name));
  return entries[0]?.path ?? null;
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
        if (prevPath && fs.existsSync(prevPath)) {
          try {
            const srcStat = fs.statSync(srcPath);
            const prevStat = fs.statSync(prevPath);
            if (srcStat.size === prevStat.size && srcStat.mtimeMs === prevStat.mtimeMs) {
              fs.linkSync(prevPath, dstPath);
              linkedFiles += 1;
              continue;
            }
          } catch {
            // Fall through to copy.
          }
        }
        fs.copyFileSync(srcPath, dstPath);
        copiedFiles += 1;
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
  let removed = 0;
  for (const file of listBackupFiles(backupDir)) {
    if (now - file.mtime.getTime() <= maxAgeMs) continue;
    let metadata = null;
    try {
      metadata = JSON.parse(fs.readFileSync(`${file.path}.meta.json`, 'utf8'));
    } catch {
      metadata = null;
    }
    fs.rmSync(file.path, { force: true });
    fs.rmSync(`${file.path}.meta.json`, { force: true });
    if (metadata?.uploadsSnapshotRelativePath) {
      fs.rmSync(path.join(backupDir, metadata.uploadsSnapshotRelativePath), {
        recursive: true,
        force: true,
      });
    }
    removed += 1;
  }
  return removed;
}

function runPgDump(databaseUrl, backupPath) {
  const result = spawnSync('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    `--file=${backupPath}`,
    resolvePostgresToolUrl(databaseUrl),
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`pg_dump fallo: ${(result.stderr || result.stdout || '').trim()}`);
  }
}

async function main() {
  const retentionDays = readPositiveInteger(process.env.PG_BACKUP_RETENTION_DAYS, DEFAULT_RETENTION_DAYS);
  const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
  const backupDir = resolveBackupDir(process.env.PG_BACKUP_DIR);
  const uploadsRoot = resolveUploadsRoot(process.env.UPLOAD_DEST);
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = formatTimestamp();
  const backupFileName = `anamneo-${timestamp}.dump`;
  const backupPath = path.join(backupDir, backupFileName);
  const startedAt = Date.now();

  try {
    runPgDump(databaseUrl, backupPath);
    const stat = fs.statSync(backupPath);
    const checksumSha256 = sha256File(backupPath);
    const uploadsSnapshot = createUploadsSnapshot(uploadsRoot, backupDir, timestamp);

    fs.writeFileSync(
      `${backupPath}.meta.json`,
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        sourceDatabase: new URL(databaseUrl).pathname.replace(/^\//, ''),
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
    console.log(JSON.stringify({
      event: 'postgres_backup_completed',
      backupFile: backupFileName,
      backupPath,
      sizeBytes: stat.size,
      checksumSha256,
      uploadsSnapshot: uploadsSnapshot.snapshotRelativePath,
      removedExpired,
      durationMs: Date.now() - startedAt,
    }));
  } catch (error) {
    fs.rmSync(backupPath, { force: true });
    console.error(JSON.stringify({
      event: 'postgres_backup_failed',
      message: error instanceof Error ? error.message : 'unknown_error',
    }));
    process.exit(1);
  }
}

main();
