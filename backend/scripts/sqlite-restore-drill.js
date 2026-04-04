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

function readBackupMetadata(sourceBackupPath) {
  const metadataPath = `${sourceBackupPath}.meta.json`;
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveDrillAttachmentPath(storagePath, sourceUploadsRoot, drillUploadsPath) {
  if (!storagePath) {
    return null;
  }

  if (path.isAbsolute(storagePath)) {
    const normalizedStoragePath = path.normalize(storagePath);
    const normalizedSourceUploadsRoot = sourceUploadsRoot ? path.normalize(sourceUploadsRoot) : null;
    const relativePath = normalizedSourceUploadsRoot
      && !path.relative(normalizedSourceUploadsRoot, normalizedStoragePath).startsWith('..')
      ? path.relative(normalizedSourceUploadsRoot, normalizedStoragePath)
      : path.basename(normalizedStoragePath);

    return path.resolve(drillUploadsPath, relativePath);
  }

  return path.resolve(drillUploadsPath, storagePath);
}

async function runIntegrityCheck(drillDbPath, sourceUploadsRoot, drillUploadsPath) {
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

    const attachments = await client.attachment.findMany({
      select: {
        storagePath: true,
      },
    });

    const missingAttachments = attachments
      .map((attachment) => resolveDrillAttachmentPath(attachment.storagePath, sourceUploadsRoot, drillUploadsPath))
      .filter((candidatePath) => candidatePath && !fs.existsSync(candidatePath));

    if (missingAttachments.length > 0) {
      throw new Error(`Restore drill fallo: faltan ${missingAttachments.length} adjunto(s) restaurados`);
    }

    return {
      attachmentCount: attachments.length,
    };
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
  const drillUploadsPath = path.join(drillDir, `restore-drill-${Date.now()}-uploads`);
  const startedAt = Date.now();
  const backupMetadata = readBackupMetadata(sourceBackupPath);
  const uploadsSnapshotPath = backupMetadata?.uploadsSnapshotRelativePath
    ? path.join(path.dirname(sourceBackupPath), backupMetadata.uploadsSnapshotRelativePath)
    : null;

  try {
    fs.copyFileSync(sourceBackupPath, drillDbPath);
    if (uploadsSnapshotPath && fs.existsSync(uploadsSnapshotPath)) {
      fs.cpSync(uploadsSnapshotPath, drillUploadsPath, { recursive: true });
    } else {
      fs.mkdirSync(drillUploadsPath, { recursive: true });
    }

    const integrity = await runIntegrityCheck(
      drillDbPath,
      backupMetadata?.uploadsRoot || null,
      drillUploadsPath,
    );

    const durationMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      event: 'sqlite_restore_drill_passed',
      sourceBackupPath,
      drillDbPath,
      drillUploadsPath,
      attachmentCount: integrity.attachmentCount,
      durationMs,
    }));
  } finally {
    fs.rmSync(drillDbPath, { force: true });
    fs.rmSync(drillUploadsPath, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'sqlite_restore_drill_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
