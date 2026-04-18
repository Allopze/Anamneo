import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDatabaseUrl } from './resolve-database-url';
import { readSqliteRestoreDrillStatus } from './sqlite-ops-state';

type SqliteSynchronousMode = 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';

type SqliteBackupInfo = {
  latestBackupFile: string | null;
  latestBackupAt: string | null;
  latestBackupAgeHours: number | null;
  maxAgeHours: number;
  isFresh: boolean;
  backupDirectoryConfigured: boolean;
};

type SqliteRestoreDrillInfo = {
  lastRestoreDrillAt: string | null;
  lastRestoreDrillAgeDays: number | null;
  frequencyDays: number;
  isDue: boolean;
  stateFilePresent: boolean;
};

type SqliteOperationalStatus = {
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

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly resolvedDatabaseUrl?: string;
  private readonly sqliteEnabled: boolean;
  private readonly sqliteBusyTimeoutMs: number;
  private readonly sqliteWalAutocheckpointPages: number;
  private readonly sqliteSynchronousMode: SqliteSynchronousMode;
  private readonly sqliteBackupMaxAgeHours: number;
  private readonly sqliteWalWarnSizeMb: number;
  private readonly sqliteBackupDir?: string;
  private readonly sqliteRestoreDrillFrequencyDays: number;

  constructor() {
    const resolvedDatabaseUrl = process.env.DATABASE_URL
      ? resolveDatabaseUrl(process.env.DATABASE_URL)
      : undefined;

    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      ...(resolvedDatabaseUrl
        ? { datasourceUrl: resolvedDatabaseUrl }
        : {}),
    });

    this.resolvedDatabaseUrl = resolvedDatabaseUrl;
    this.sqliteEnabled = Boolean(resolvedDatabaseUrl && resolvedDatabaseUrl.startsWith('file:'));
    this.sqliteBusyTimeoutMs = PrismaService.readPositiveInteger(process.env.SQLITE_BUSY_TIMEOUT_MS, 5000);
    this.sqliteWalAutocheckpointPages = PrismaService.readPositiveInteger(
      process.env.SQLITE_WAL_AUTOCHECKPOINT_PAGES,
      1000,
    );
    this.sqliteSynchronousMode = PrismaService.readSynchronousMode(process.env.SQLITE_SYNCHRONOUS);
    this.sqliteBackupMaxAgeHours = PrismaService.readPositiveInteger(process.env.SQLITE_BACKUP_MAX_AGE_HOURS, 24);
    this.sqliteWalWarnSizeMb = PrismaService.readPositiveInteger(process.env.SQLITE_WAL_WARN_SIZE_MB, 128);
    this.sqliteRestoreDrillFrequencyDays = PrismaService.readPositiveInteger(
      process.env.SQLITE_RESTORE_DRILL_FREQUENCY_DAYS,
      7,
    );
    this.sqliteBackupDir = process.env.SQLITE_BACKUP_DIR?.trim() || undefined;
  }

  async onModuleInit() {
    await this.$connect();
    await this.configureSqliteOperationalPragmas();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    // Delete in order respecting relations
    await this.attachment.deleteMany();
    await this.conditionSuggestionLog.deleteMany();
    await this.encounterSection.deleteMany();
    await this.encounter.deleteMany();
    await this.patientHistory.deleteMany();
    await this.patient.deleteMany();
    await this.auditLog.deleteMany();
    await this.conditionCatalog.deleteMany();
    await this.user.deleteMany();
  }

  private static readPositiveInteger(rawValue: string | undefined, fallback: number): number {
    if (!rawValue) {
      return fallback;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }

  private static readSynchronousMode(rawValue: string | undefined): SqliteSynchronousMode {
    const normalized = (rawValue ?? 'NORMAL').trim().toUpperCase();
    if (normalized === 'OFF' || normalized === 'NORMAL' || normalized === 'FULL' || normalized === 'EXTRA') {
      return normalized;
    }

    return 'NORMAL';
  }

  private getSqliteDatabasePath(): string | null {
    if (!this.sqliteEnabled || !this.resolvedDatabaseUrl) {
      return null;
    }

    const rawPath = this.resolvedDatabaseUrl.slice('file:'.length);
    if (!rawPath) {
      return null;
    }

    const decodedPath = decodeURIComponent(rawPath);
    const absolutePath = path.isAbsolute(decodedPath)
      ? decodedPath
      : path.resolve(process.cwd(), decodedPath);

    return path.normalize(absolutePath);
  }

  private resolveBackupDirectory(dbPath: string): string {
    if (this.sqliteBackupDir) {
      return path.isAbsolute(this.sqliteBackupDir)
        ? this.sqliteBackupDir
        : path.resolve(process.cwd(), this.sqliteBackupDir);
    }

    return path.resolve(path.dirname(dbPath), 'backups');
  }

  private readFileSize(filePath: string | null): number | null {
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

  private getLatestBackupInfo(backupDir: string): {
    fileName: string;
    modifiedAt: Date;
  } | null {
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

  private async configureSqliteOperationalPragmas(): Promise<void> {
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON;');

    if (!this.sqliteEnabled) {
      return;
    }

    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await this.$queryRawUnsafe(`PRAGMA synchronous = ${this.sqliteSynchronousMode};`);
    await this.$queryRawUnsafe(`PRAGMA busy_timeout = ${this.sqliteBusyTimeoutMs};`);
    await this.$queryRawUnsafe(`PRAGMA wal_autocheckpoint = ${this.sqliteWalAutocheckpointPages};`);
  }

  private async readPragmaValue(pragmaName: string): Promise<string | number | null> {
    const rows = await this.$queryRawUnsafe<Array<Record<string, unknown>>>(`PRAGMA ${pragmaName};`);
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

  private toNumber(value: string | number | null): number | null {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  async getDatabaseHealth(): Promise<{ status: 'ok' | 'error'; driver: 'sqlite' | 'other'; message?: string }> {
    try {
      await this.$queryRawUnsafe('SELECT 1;');
      return {
        status: 'ok',
        driver: this.sqliteEnabled ? 'sqlite' : 'other',
      };
    } catch (error) {
      return {
        status: 'error',
        driver: this.sqliteEnabled ? 'sqlite' : 'other',
        message: error instanceof Error ? error.message : 'database_unreachable',
      };
    }
  }

  async getSqliteOperationalStatus(): Promise<SqliteOperationalStatus> {
    if (!this.sqliteEnabled) {
      return {
        enabled: false,
        status: 'not_applicable',
        pragmas: {
          journalMode: null,
          synchronous: null,
          busyTimeoutMs: null,
          walAutocheckpointPages: null,
        },
        files: {
          databaseSizeBytes: null,
          walSizeBytes: null,
          walWarnThresholdBytes: this.sqliteWalWarnSizeMb * 1024 * 1024,
        },
        backups: {
          latestBackupFile: null,
          latestBackupAt: null,
          latestBackupAgeHours: null,
          maxAgeHours: this.sqliteBackupMaxAgeHours,
          isFresh: false,
          backupDirectoryConfigured: Boolean(this.sqliteBackupDir),
        },
        restoreDrill: {
          lastRestoreDrillAt: null,
          lastRestoreDrillAgeDays: null,
          frequencyDays: this.sqliteRestoreDrillFrequencyDays,
          isDue: false,
          stateFilePresent: false,
        },
        warnings: [],
      };
    }

    const warnings: string[] = [];
    const journalModeRaw = await this.readPragmaValue('journal_mode');
    const synchronousRaw = await this.readPragmaValue('synchronous');
    const busyTimeoutRaw = await this.readPragmaValue('busy_timeout');
    const walAutocheckpointRaw = await this.readPragmaValue('wal_autocheckpoint');

    const journalMode = typeof journalModeRaw === 'string' ? journalModeRaw.toUpperCase() : null;
    const synchronous = typeof synchronousRaw === 'string' ? synchronousRaw.toUpperCase() : null;
    const busyTimeoutMs = this.toNumber(busyTimeoutRaw);
    const walAutocheckpointPages = this.toNumber(walAutocheckpointRaw);

    if (journalMode !== 'WAL') {
      warnings.push('journal_mode_is_not_wal');
    }
    if (synchronous === 'OFF') {
      warnings.push('synchronous_mode_is_off');
    }
    if (busyTimeoutMs !== null && busyTimeoutMs < 5000) {
      warnings.push('busy_timeout_below_recommended_threshold');
    }
    if (walAutocheckpointPages !== null && walAutocheckpointPages <= 0) {
      warnings.push('wal_autocheckpoint_disabled');
    }

    const dbPath = this.getSqliteDatabasePath();
    const walPath = dbPath ? `${dbPath}-wal` : null;

    const databaseSizeBytes = this.readFileSize(dbPath);
    const walSizeBytes = this.readFileSize(walPath);
    const walWarnThresholdBytes = this.sqliteWalWarnSizeMb * 1024 * 1024;

    if (databaseSizeBytes === null) {
      warnings.push('database_file_not_found');
    }
    if (walSizeBytes !== null && walSizeBytes > walWarnThresholdBytes) {
      warnings.push('wal_size_above_threshold');
    }

    let latestBackupFile: string | null = null;
    let latestBackupAt: string | null = null;
    let latestBackupAgeHours: number | null = null;
    let isBackupFresh = false;
    let restoreDrill: SqliteRestoreDrillInfo = {
      lastRestoreDrillAt: null,
      lastRestoreDrillAgeDays: null,
      frequencyDays: this.sqliteRestoreDrillFrequencyDays,
      isDue: false,
      stateFilePresent: false,
    };

    if (dbPath) {
      const backupDir = this.resolveBackupDirectory(dbPath);
      const latestBackup = this.getLatestBackupInfo(backupDir);
      restoreDrill = readSqliteRestoreDrillStatus(
        backupDir,
        this.sqliteRestoreDrillFrequencyDays,
      );

      if (latestBackup) {
        latestBackupFile = latestBackup.fileName;
        latestBackupAt = latestBackup.modifiedAt.toISOString();
        latestBackupAgeHours = Number(
          ((Date.now() - latestBackup.modifiedAt.getTime()) / (1000 * 60 * 60)).toFixed(2),
        );
        isBackupFresh = latestBackupAgeHours <= this.sqliteBackupMaxAgeHours;
      }
    }

    if (!latestBackupFile) {
      warnings.push('no_backup_found');
    } else if (!isBackupFresh) {
      warnings.push('latest_backup_is_stale');
    }

    if (!restoreDrill.lastRestoreDrillAt) {
      warnings.push('restore_drill_never_ran');
    } else if (restoreDrill.isDue) {
      warnings.push('restore_drill_overdue');
    }

    return {
      enabled: true,
      status: warnings.length > 0 ? 'warn' : 'ok',
      pragmas: {
        journalMode,
        synchronous,
        busyTimeoutMs,
        walAutocheckpointPages,
      },
      files: {
        databaseSizeBytes,
        walSizeBytes,
        walWarnThresholdBytes,
      },
      backups: {
        latestBackupFile,
        latestBackupAt,
        latestBackupAgeHours,
        maxAgeHours: this.sqliteBackupMaxAgeHours,
        isFresh: isBackupFresh,
        backupDirectoryConfigured: Boolean(this.sqliteBackupDir),
      },
      restoreDrill,
      warnings,
    };
  }
}
