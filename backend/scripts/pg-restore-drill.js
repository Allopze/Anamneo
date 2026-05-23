/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const {
  buildDatabaseUrlWithName,
  listBackupFiles,
  resolveBackupDir,
  resolveMigrationDatabaseUrl,
} = require('./pg-utils');

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function readBackupMetadata(sourceBackupPath) {
  try {
    return JSON.parse(fs.readFileSync(`${sourceBackupPath}.meta.json`, 'utf8'));
  } catch {
    return null;
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`${command} fallo: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout;
}

function resolveDrillAttachmentPath(storagePath, sourceUploadsRoot, drillUploadsPath) {
  if (!storagePath) return null;
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

async function validateRestoredDatabase(databaseUrl, sourceUploadsRoot, drillUploadsPath) {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await client.$connect();
    await client.$queryRawUnsafe('SELECT 1;');
    const tableRows = await client.$queryRawUnsafe(
      "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public';",
    );
    const tableCount = Number(tableRows?.[0]?.count ?? 0);
    if (tableCount === 0) {
      throw new Error('Restore drill fallo: la base restaurada no contiene tablas publicas');
    }

    const attachments = await client.attachment.findMany({ select: { storagePath: true } });
    const missingAttachments = attachments
      .map((attachment) => resolveDrillAttachmentPath(attachment.storagePath, sourceUploadsRoot, drillUploadsPath))
      .filter((candidatePath) => candidatePath && !fs.existsSync(candidatePath));
    if (missingAttachments.length > 0) {
      throw new Error(`Restore drill fallo: faltan ${missingAttachments.length} adjunto(s) restaurados`);
    }

    return { tableCount, attachmentCount: attachments.length };
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const adminUrl = resolveMigrationDatabaseUrl();
  const backupDir = resolveBackupDir(process.env.PG_BACKUP_DIR);
  const fromArg = readArg('from');
  const sourceBackupPath = fromArg
    ? path.resolve(fromArg)
    : (() => {
      const latestBackup = listBackupFiles(backupDir)[0];
      if (!latestBackup) throw new Error(`No se encontraron backups .dump en ${backupDir}`);
      return latestBackup.path;
    })();

  if (!fs.existsSync(sourceBackupPath)) {
    throw new Error(`Backup no encontrado: ${sourceBackupPath}`);
  }

  const drillDatabaseName = `anamneo_restore_drill_${Date.now()}`;
  const drillDatabaseUrl = buildDatabaseUrlWithName(adminUrl, drillDatabaseName);
  const adminMaintenanceUrl = buildDatabaseUrlWithName(adminUrl, 'postgres');
  const drillDir = path.join(backupDir, 'restore-drills');
  const drillUploadsPath = path.join(drillDir, `restore-drill-${Date.now()}-uploads`);
  const startedAt = Date.now();
  const backupMetadata = readBackupMetadata(sourceBackupPath);
  const uploadsSnapshotPath = backupMetadata?.uploadsSnapshotRelativePath
    ? path.join(path.dirname(sourceBackupPath), backupMetadata.uploadsSnapshotRelativePath)
    : null;

  fs.mkdirSync(drillDir, { recursive: true });

  try {
    run('createdb', [`--dbname=${adminMaintenanceUrl}`, drillDatabaseName]);
    run('pg_restore', ['--no-owner', '--no-privileges', `--dbname=${drillDatabaseUrl}`, sourceBackupPath]);

    if (uploadsSnapshotPath && fs.existsSync(uploadsSnapshotPath)) {
      fs.cpSync(uploadsSnapshotPath, drillUploadsPath, { recursive: true });
    } else {
      fs.mkdirSync(drillUploadsPath, { recursive: true });
    }

    const validation = await validateRestoredDatabase(
      drillDatabaseUrl,
      backupMetadata?.uploadsRoot || null,
      drillUploadsPath,
    );

    console.log(JSON.stringify({
      event: 'postgres_restore_drill_passed',
      sourceBackupPath,
      drillDatabaseName,
      drillUploadsPath,
      ...validation,
      durationMs: Date.now() - startedAt,
    }));
  } finally {
    try {
      run('dropdb', ['--if-exists', `--dbname=${adminMaintenanceUrl}`, drillDatabaseName]);
    } catch {
      // Best effort cleanup.
    }
    fs.rmSync(drillUploadsPath, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'postgres_restore_drill_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
