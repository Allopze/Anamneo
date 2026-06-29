/* eslint-disable no-console */

/**
 * Off-machine backup mirror.
 *
 * Copies the local backup directory (dumps + .meta.json + uploads snapshots) to a
 * second location — e.g. an external drive or a cloud-synced folder mounted into the
 * container — so a disk/host failure does not lose the database and its backups at once.
 *
 * Opt-in: if PG_BACKUP_MIRROR_DIR is not set, this is a no-op (exit 0) so the backup
 * cycle (pg-ops-runner --mode=all) stays green for deployments without a mirror target.
 *
 * Behaviour:
 *  - Incremental: copies only files not already present in the mirror with the same
 *    size and mtime; preserves mtime so subsequent runs skip unchanged files.
 *  - Independent retention: prunes mirror dumps older than PG_BACKUP_MIRROR_RETENTION_DAYS
 *    (defaults to PG_BACKUP_RETENTION_DAYS / 14). Source deletions are NOT propagated
 *    destructively — the mirror prunes on its own age policy.
 *  - Never copies transient artefacts (restore-drills/, .pg-ops-state.json).
 */

const fs = require('fs');
const path = require('path');
const { resolveBackupDir, readPositiveInteger } = require('./pg-utils');

const DEFAULT_RETENTION_DAYS = 14;
const EXCLUDED_TOP_LEVEL = new Set(['restore-drills', '.pg-ops-state.json']);

function resolveMirrorDir(rawValue) {
  const value = (rawValue || '').trim();
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function sameFile(srcStat, destPath) {
  if (!fs.existsSync(destPath)) return false;
  const destStat = fs.statSync(destPath);
  return (
    destStat.isFile()
    && destStat.size === srcStat.size
    && Math.floor(destStat.mtimeMs / 1000) === Math.floor(srcStat.mtimeMs / 1000)
  );
}

function copyTree(srcDir, destDir, isTopLevel, counters) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (isTopLevel && EXCLUDED_TOP_LEVEL.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath, false, counters);
      continue;
    }
    if (!entry.isFile()) continue;
    const srcStat = fs.statSync(srcPath);
    if (sameFile(srcStat, destPath)) {
      counters.skippedFiles += 1;
      continue;
    }
    fs.copyFileSync(srcPath, destPath);
    fs.utimesSync(destPath, srcStat.atime, srcStat.mtime);
    counters.copiedFiles += 1;
    counters.copiedBytes += srcStat.size;
  }
}

function pruneExpiredMirror(mirrorDir, retentionDays) {
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let removed = 0;
  if (!fs.existsSync(mirrorDir)) return removed;

  for (const entry of fs.readdirSync(mirrorDir, { withFileTypes: true })) {
    const entryPath = path.join(mirrorDir, entry.name);
    if (EXCLUDED_TOP_LEVEL.has(entry.name)) continue;

    if (entry.isFile() && (entry.name.endsWith('.dump') || entry.name.endsWith('.backup'))) {
      if (now - fs.statSync(entryPath).mtime.getTime() <= maxAgeMs) continue;
      let metadata = null;
      try {
        metadata = JSON.parse(fs.readFileSync(`${entryPath}.meta.json`, 'utf8'));
      } catch {
        metadata = null;
      }
      fs.rmSync(entryPath, { force: true });
      fs.rmSync(`${entryPath}.meta.json`, { force: true });
      if (metadata?.uploadsSnapshotRelativePath) {
        fs.rmSync(path.join(mirrorDir, metadata.uploadsSnapshotRelativePath), { recursive: true, force: true });
      }
      removed += 1;
    }
  }

  // Prune orphaned uploads snapshots older than retention.
  const uploadsDir = path.join(mirrorDir, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    for (const entry of fs.readdirSync(uploadsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('anamneo-')) continue;
      const snapshotPath = path.join(uploadsDir, entry.name);
      if (now - fs.statSync(snapshotPath).mtime.getTime() > maxAgeMs) {
        fs.rmSync(snapshotPath, { recursive: true, force: true });
      }
    }
  }

  return removed;
}

function runMirror() {
  const mirrorDir = resolveMirrorDir(process.env.PG_BACKUP_MIRROR_DIR);
  if (!mirrorDir) {
    return { event: 'postgres_backup_mirror_skipped', reason: 'mirror_dir_not_configured' };
  }

  const sourceDir = resolveBackupDir(process.env.PG_BACKUP_DIR);
  if (!fs.existsSync(sourceDir)) {
    return { event: 'postgres_backup_mirror_skipped', reason: 'source_dir_missing', sourceDir };
  }
  if (path.resolve(mirrorDir) === path.resolve(sourceDir)) {
    throw new Error('PG_BACKUP_MIRROR_DIR no puede ser igual a PG_BACKUP_DIR');
  }

  const retentionDays = readPositiveInteger(
    process.env.PG_BACKUP_MIRROR_RETENTION_DAYS,
    readPositiveInteger(process.env.PG_BACKUP_RETENTION_DAYS, DEFAULT_RETENTION_DAYS),
  );
  const startedAt = Date.now();
  const counters = { copiedFiles: 0, skippedFiles: 0, copiedBytes: 0 };

  fs.mkdirSync(mirrorDir, { recursive: true });
  copyTree(sourceDir, mirrorDir, true, counters);
  const removedExpired = pruneExpiredMirror(mirrorDir, retentionDays);

  return {
    event: 'postgres_backup_mirror_completed',
    mirrorDir,
    sourceDir,
    retentionDays,
    copiedFiles: counters.copiedFiles,
    skippedFiles: counters.skippedFiles,
    copiedBytes: counters.copiedBytes,
    removedExpired,
    durationMs: Date.now() - startedAt,
  };
}

function main() {
  try {
    console.log(JSON.stringify(runMirror()));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'postgres_backup_mirror_failed',
      message: error instanceof Error ? error.message : 'unknown_error',
    }));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMirror, resolveMirrorDir, pruneExpiredMirror };
