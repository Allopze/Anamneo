import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { readSqliteRestoreDrillStatus } from './sqlite-ops-state';

export type SqliteSynchronousMode = 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';

export type SqliteBackupInfo = {
  latestBackupFile: string | null;
  latestBackupAt: string | null;
  latestBackupAgeHours: number | null;
  maxAgeHours: number;
  isFresh: boolean;
  backupDirectoryConfigured: boolean;
};

export type SqliteRestoreDrillInfo = {
  lastRestoreDrillAt: string | null;
  lastRestoreDrillAgeDays: number | null;
  frequencyDays: number;
  isDue: boolean;
  stateFilePresent: boolean;
};

export type SqliteOperationalStatus = {
  enabled: boolean;
  status: 'ok' | 'warn' | 'not_applicable';
  pragmas: {
    journalMode: string | null;
    synchronous: string | null;
    busyTimeoutMs: number | null;
    walAutocheckpointPages: number | null;
  };
  files: {
    databaseSizeBytes: number | null;
    walSizeBytes: number | null;
    walWarnThresholdBytes: number;
  };
  backups: SqliteBackupInfo;
  restoreDrill: SqliteRestoreDrillInfo;
  warnings: string[];
};

export function readPositiveInteger(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function readSynchronousMode(rawValue: string | undefined): SqliteSynchronousMode {
  const normalized = (rawValue ?? 'NORMAL').trim().toUpperCase();
  if (normalized === 'OFF' || normalized === 'NORMAL' || normalized === 'FULL' || normalized === 'EXTRA') {
    return normalized;
  }

  return 'NORMAL';
}

export function getSqliteDatabasePath(resolvedDatabaseUrl?: string): string | null {
  if (!resolvedDatabaseUrl || !resolvedDatabaseUrl.startsWith('file:')) {
    return null;
  }

  const rawPath = resolvedDatabaseUrl.slice('file:'.length);
  if (!rawPath) {
    return null;
  }

  const decodedPath = decodeURIComponent(rawPath);
  const absolutePath = path.isAbsolute(decodedPath)
    ? decodedPath
    : path.resolve(process.cwd(), decodedPath);

  return path.normalize(absolutePath);
}

export function resolveBackupDirectory(dbPath: string, sqliteBackupDir?: string): string {
  if (sqliteBackupDir) {
    return path.isAbsolute(sqliteBackupDir)
      ? sqliteBackupDir
      : path.resolve(process.cwd(), sqliteBackupDir);
  }

  return path.resolve(path.dirname(dbPath), 'backups');
}

export function readFileSize(filePath: string | null): number | null {
  if (!filePath) {
    return null;
  }

  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch {
    return null;
  }
}

export function getLatestBackupInfo(backupDir: string): { fileName: string; modifiedAt: Date } | null {
  try {
    if (!fs.existsSync(backupDir)) {
      return null;
    }

    const candidates = fs.readdirSync(backupDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.db'))
      .map((entry) => {
        const fullPath = path.join(backupDir, entry.name);
        const stat = fs.statSync(fullPath);
        return {
          fileName: entry.name,
          modifiedAt: stat.mtime,
        };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

export async function configureSqliteOperationalPragmas(
  prismaClient: PrismaClient,
  sqliteEnabled: boolean,
  sqliteSynchronousMode: SqliteSynchronousMode,
  sqliteBusyTimeoutMs: number,
  sqliteWalAutocheckpointPages: number,
): Promise<void> {
  await prismaClient.$queryRawUnsafe('PRAGMA foreign_keys = ON;');

  if (!sqliteEnabled) {
    return;
  }

  await prismaClient.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  await prismaClient.$queryRawUnsafe(`PRAGMA synchronous = ${sqliteSynchronousMode};`);
  await prismaClient.$queryRawUnsafe(`PRAGMA busy_timeout = ${sqliteBusyTimeoutMs};`);
  await prismaClient.$queryRawUnsafe(`PRAGMA wal_autocheckpoint = ${sqliteWalAutocheckpointPages};`);
}

export async function readPragmaValue(
  prismaClient: PrismaClient,
  pragmaName: string,
): Promise<string | number | null> {
  const rows = await prismaClient.$queryRawUnsafe<Array<Record<string, unknown>>>(`PRAGMA ${pragmaName};`);
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];
  const firstValue = Object.values(firstRow)[0];
  if (typeof firstValue === 'number' || typeof firstValue === 'string') {
    return firstValue;
  }

  return null;
}

export function toNumber(value: string | number | null): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
