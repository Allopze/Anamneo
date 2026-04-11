/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function parseAndApplyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return parsed;
}

function loadDefaultEnv() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '..', '.env'),
  ];

  for (const candidate of candidates) {
    const parsed = parseAndApplyEnvFile(candidate);

    if (
      typeof parsed.DATABASE_URL === 'string'
      && parsed.DATABASE_URL.startsWith('file:')
      && process.env.DATABASE_URL
      && !process.env.DATABASE_URL.startsWith('file:')
    ) {
      process.env.DATABASE_URL = parsed.DATABASE_URL;
    }
  }
}

loadDefaultEnv();

function toPrismaFileUrl(dbPath) {
  return `file:${dbPath.replace(/\\/g, '/')}`;
}

function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl || !databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const rawPath = databaseUrl.slice('file:'.length);
  if (!rawPath.startsWith('.')) {
    return databaseUrl;
  }

  const cwd = process.cwd();
  const parent = path.resolve(cwd, '..');
  const normalizedRelativePath = rawPath.replace(/^\.\//, '');
  const dbFileName = path.basename(normalizedRelativePath);

  const directCandidates = [
    path.resolve(cwd, rawPath),
    path.resolve(parent, rawPath),
    path.resolve(cwd, rawPath.replace(/^\.\/backend\//, './')),
    path.resolve(parent, rawPath.replace(/^\.\/backend\//, './')),
  ];

  const prismaCandidates = [
    path.resolve(cwd, 'prisma', dbFileName),
    path.resolve(cwd, 'backend', 'prisma', dbFileName),
    path.resolve(parent, 'backend', 'prisma', dbFileName),
  ];

  const candidates = dbFileName === 'dev.db'
    ? [...prismaCandidates, ...directCandidates]
    : [...directCandidates, ...prismaCandidates];

  const existingPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (existingPath) {
    return toPrismaFileUrl(existingPath);
  }

  const candidateWithExistingDir = candidates.find((candidate) => fs.existsSync(path.dirname(candidate)));
  return toPrismaFileUrl(candidateWithExistingDir || candidates[0]);
}

function resolveSqliteDatabasePath(databaseUrl = process.env.DATABASE_URL) {
  const resolvedUrl = resolveDatabaseUrl(databaseUrl);
  if (!resolvedUrl || !resolvedUrl.startsWith('file:')) {
    throw new Error('DATABASE_URL debe usar formato file: para operaciones SQLite');
  }

  const rawPath = decodeURIComponent(resolvedUrl.slice('file:'.length));
  if (!rawPath) {
    throw new Error('No se pudo resolver la ruta de la base SQLite');
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function resolveBackupDir(dbPath, configuredBackupDir = process.env.SQLITE_BACKUP_DIR) {
  if (configuredBackupDir && configuredBackupDir.trim().length > 0) {
    return path.isAbsolute(configuredBackupDir)
      ? configuredBackupDir
      : path.resolve(process.cwd(), configuredBackupDir);
  }

  return path.resolve(path.dirname(dbPath), 'backups');
}

function resolveUploadsRoot(configuredUploadDest = process.env.UPLOAD_DEST) {
  const appRoot = path.resolve(process.cwd());
  const uploadDest = configuredUploadDest && configuredUploadDest.trim().length > 0
    ? configuredUploadDest.trim()
    : './uploads';

  const absoluteUploadDest = path.isAbsolute(uploadDest)
    ? uploadDest
    : path.resolve(process.cwd(), uploadDest);
  const relativeToAppRoot = path.relative(appRoot, absoluteUploadDest);

  if (relativeToAppRoot.startsWith('..') || path.isAbsolute(relativeToAppRoot)) {
    throw new Error(`UPLOAD_DEST debe permanecer dentro de ${appRoot}. Valor recibido: ${uploadDest}`);
  }

  return absoluteUploadDest;
}

function listBackupFiles(backupDir) {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs.readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.db'))
    .map((entry) => {
      const fullPath = path.join(backupDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        path: fullPath,
        sizeBytes: stat.size,
        mtime: stat.mtime,
      };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

function escapeSqliteString(value) {
  return String(value).replace(/'/g, "''");
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function readPositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function readFirstColumn(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || typeof rows[0] !== 'object' || rows[0] === null) {
    return null;
  }

  const first = Object.values(rows[0])[0];
  if (typeof first === 'string' || typeof first === 'number') {
    return first;
  }

  return null;
}

module.exports = {
  loadDefaultEnv,
  toPrismaFileUrl,
  resolveDatabaseUrl,
  resolveSqliteDatabasePath,
  resolveBackupDir,
  resolveUploadsRoot,
  listBackupFiles,
  escapeSqliteString,
  formatTimestamp,
  readPositiveInteger,
  readFirstColumn,
};
