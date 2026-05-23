/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function parseAndApplyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return parsed;
}

function loadDefaultEnv() {
  const cwd = process.cwd();
  [path.resolve(cwd, '.env'), path.resolve(cwd, '..', '.env')].forEach(parseAndApplyEnvFile);
}

loadDefaultEnv();

function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl || (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://'))) {
    throw new Error('DATABASE_URL debe usar postgresql:// o postgres:// para operaciones PostgreSQL');
  }
  return databaseUrl;
}

function resolveMigrationDatabaseUrl() {
  return resolveDatabaseUrl(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
}

function resolveConfiguredPath(configuredPath) {
  if (path.isAbsolute(configuredPath)) return configuredPath;
  const cwd = process.cwd();
  const parent = path.resolve(cwd, '..');
  const normalizedPath = configuredPath.replace(/\\/g, '/');
  const normalizedWithoutBackendPrefix = normalizedPath.replace(/^\.\/backend\//, './');
  const candidates = [
    path.resolve(cwd, configuredPath),
    path.resolve(parent, configuredPath),
  ];
  if (normalizedWithoutBackendPrefix !== normalizedPath) {
    candidates.push(
      path.resolve(cwd, normalizedWithoutBackendPrefix),
      path.resolve(parent, normalizedWithoutBackendPrefix),
    );
  }
  const uniqueCandidates = [...new Set(candidates)];
  const existingPath = uniqueCandidates.find((candidate) => fs.existsSync(candidate));
  if (existingPath) return existingPath;
  return uniqueCandidates.find((candidate) => fs.existsSync(path.dirname(candidate))) || uniqueCandidates[0];
}

function resolveBackupDir(configuredBackupDir = process.env.PG_BACKUP_DIR) {
  if (configuredBackupDir && configuredBackupDir.trim().length > 0) {
    return resolveConfiguredPath(configuredBackupDir.trim());
  }
  return path.resolve(process.cwd(), 'backups');
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
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.dump') || entry.name.endsWith('.backup')))
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDatabaseName(databaseUrl) {
  const url = new URL(resolveDatabaseUrl(databaseUrl));
  return url.pathname.replace(/^\//, '');
}

function buildDatabaseUrlWithName(databaseUrl, databaseName) {
  const url = new URL(resolveDatabaseUrl(databaseUrl));
  url.pathname = `/${databaseName}`;
  return url.toString();
}

module.exports = {
  resolveDatabaseUrl,
  resolveMigrationDatabaseUrl,
  resolveBackupDir,
  resolveUploadsRoot,
  listBackupFiles,
  formatTimestamp,
  readPositiveInteger,
  parseDatabaseName,
  buildDatabaseUrlWithName,
};
