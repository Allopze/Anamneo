import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './resolve-database-url';
import { readSqliteRestoreDrillStatus } from './sqlite-ops-state';
import {
  SqliteOperationalStatus,
  SqliteRestoreDrillInfo,
  SqliteSynchronousMode,
  configureSqliteOperationalPragmas,
  getLatestBackupInfo,
  getSqliteDatabasePath,
  readFileSize,
  readPositiveInteger,
  readPragmaValue,
  readSynchronousMode,
  resolveBackupDirectory,
  toNumber,
} from './prisma.service.helpers';

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
    this.sqliteBusyTimeoutMs = readPositiveInteger(process.env.SQLITE_BUSY_TIMEOUT_MS, 5000);
    this.sqliteWalAutocheckpointPages = readPositiveInteger(
      process.env.SQLITE_WAL_AUTOCHECKPOINT_PAGES,
      1000,
    );
    this.sqliteSynchronousMode = readSynchronousMode(process.env.SQLITE_SYNCHRONOUS);
    this.sqliteBackupMaxAgeHours = readPositiveInteger(process.env.SQLITE_BACKUP_MAX_AGE_HOURS, 24);
    this.sqliteWalWarnSizeMb = readPositiveInteger(process.env.SQLITE_WAL_WARN_SIZE_MB, 128);
    this.sqliteRestoreDrillFrequencyDays = readPositiveInteger(
      process.env.SQLITE_RESTORE_DRILL_FREQUENCY_DAYS,
      7,
    );
    this.sqliteBackupDir = process.env.SQLITE_BACKUP_DIR?.trim() || undefined;
  }

  async onModuleInit() {
    await this.$connect();
    await configureSqliteOperationalPragmas(
      this,
      this.sqliteEnabled,
      this.sqliteSynchronousMode,
      this.sqliteBusyTimeoutMs,
      this.sqliteWalAutocheckpointPages,
    );
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
    await this.medicationCatalog.deleteMany();
    await this.user.deleteMany();
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
    const journalModeRaw = await readPragmaValue(this, 'journal_mode');
    const synchronousRaw = await readPragmaValue(this, 'synchronous');
    const busyTimeoutRaw = await readPragmaValue(this, 'busy_timeout');
    const walAutocheckpointRaw = await readPragmaValue(this, 'wal_autocheckpoint');

    const journalMode = typeof journalModeRaw === 'string' ? journalModeRaw.toUpperCase() : null;
    const synchronous = typeof synchronousRaw === 'string' ? synchronousRaw.toUpperCase() : null;
    const busyTimeoutMs = toNumber(busyTimeoutRaw);
    const walAutocheckpointPages = toNumber(walAutocheckpointRaw);

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

    const dbPath = getSqliteDatabasePath(this.resolvedDatabaseUrl);
    const walPath = dbPath ? `${dbPath}-wal` : null;

    const databaseSizeBytes = readFileSize(dbPath);
    const walSizeBytes = readFileSize(walPath);
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
      const backupDir = resolveBackupDirectory(dbPath, this.sqliteBackupDir);
      const latestBackup = getLatestBackupInfo(backupDir);
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
