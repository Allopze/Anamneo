import * as fs from 'fs';
import * as path from 'path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readPostgresRestoreDrillStatus } from './postgres-ops-state';

type PostgresConnectionRow = {
  total: number | string | bigint;
  active: number | string | bigint;
  idle: number | string | bigint;
};

type PostgresLockRow = {
  waiting: number | string | bigint;
  longRunning: number | string | bigint;
};

type PostgresSizeRow = {
  sizeBytes: number | string | bigint;
};

export type DatabaseOperationalStatus = {
  enabled: boolean;
  driver: 'postgres';
  status: 'ok' | 'warn';
  version: string | null;
  sizeBytes: number | null;
  connections: {
    total: number;
    active: number;
    idle: number;
  };
  locks: {
    waiting: number;
    longRunning: number;
  };
  backups: {
    latestBackupFile: string | null;
    latestBackupAt: string | null;
    latestBackupAgeHours: number | null;
    maxAgeHours: number;
    isFresh: boolean;
    backupDirectoryConfigured: boolean;
  };
  restoreDrill: {
    lastRestoreDrillAt: string | null;
    lastRestoreDrillAgeDays: number | null;
    frequencyDays: number;
    isDue: boolean;
    stateFilePresent: boolean;
  };
  warnings: string[];
};

function readPositiveInteger(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNumber(value: number | string | bigint | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function resolveBackupDirectory(configuredBackupDir?: string): string {
  const fallback = path.resolve(process.cwd(), 'backups');
  if (!configuredBackupDir) return fallback;
  return path.isAbsolute(configuredBackupDir)
    ? configuredBackupDir
    : path.resolve(process.cwd(), configuredBackupDir);
}

function getLatestBackupInfo(backupDir: string): { fileName: string; modifiedAt: Date } | null {
  try {
    if (!fs.existsSync(backupDir)) return null;
    const candidates = fs.readdirSync(backupDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.dump') || entry.name.endsWith('.backup')))
      .map((entry) => {
        const fullPath = path.join(backupDir, entry.name);
        const stat = fs.statSync(fullPath);
        return { fileName: entry.name, modifiedAt: stat.mtime };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly backupMaxAgeHours: number;
  private readonly restoreDrillFrequencyDays: number;
  private readonly backupDir?: string;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });

    this.backupMaxAgeHours = readPositiveInteger(process.env.PG_BACKUP_MAX_AGE_HOURS, 24);
    this.restoreDrillFrequencyDays = readPositiveInteger(
      process.env.PG_RESTORE_DRILL_FREQUENCY_DAYS,
      7,
    );
    this.backupDir = process.env.PG_BACKUP_DIR?.trim() || undefined;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    await this.$executeRawUnsafe(`
      DO $$
      DECLARE
        table_list text;
      BEGIN
        SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
        INTO table_list
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations';

        IF table_list IS NOT NULL THEN
          EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
        END IF;
      END $$;
    `);
  }

  async getDatabaseHealth(): Promise<{
    status: 'ok' | 'error';
    driver: 'postgres';
    message?: string;
  }> {
    try {
      await this.$queryRawUnsafe('SELECT 1;');
      return { status: 'ok', driver: 'postgres' };
    } catch (error) {
      return {
        status: 'error',
        driver: 'postgres',
        message: error instanceof Error ? error.message : 'database_unreachable',
      };
    }
  }

  async getDatabaseOperationalStatus(): Promise<DatabaseOperationalStatus> {
    const warnings: string[] = [];
    const [versionRow] = await this.$queryRawUnsafe<Array<{ version: string }>>('SELECT version();');
    const [sizeRow] = await this.$queryRawUnsafe<PostgresSizeRow[]>(
      'SELECT pg_database_size(current_database()) AS "sizeBytes";',
    );
    const [connectionRow] = await this.$queryRawUnsafe<PostgresConnectionRow[]>(
      "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE state = 'active') AS active, COUNT(*) FILTER (WHERE state = 'idle') AS idle FROM pg_stat_activity WHERE datname = current_database();",
    );
    const [lockRow] = await this.$queryRawUnsafe<PostgresLockRow[]>(
      "SELECT COUNT(*) FILTER (WHERE NOT granted) AS waiting, COUNT(*) FILTER (WHERE granted AND now() - COALESCE(query_start, now()) > interval '5 minutes') AS \"longRunning\" FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid = l.pid WHERE a.datname = current_database();",
    );

    const backupDir = resolveBackupDirectory(this.backupDir);
    const latestBackup = getLatestBackupInfo(backupDir);
    const restoreDrill = readPostgresRestoreDrillStatus(
      backupDir,
      this.restoreDrillFrequencyDays,
    );

    let latestBackupAgeHours: number | null = null;
    let isFresh = false;
    if (latestBackup) {
      latestBackupAgeHours = Number(
        ((Date.now() - latestBackup.modifiedAt.getTime()) / (1000 * 60 * 60)).toFixed(2),
      );
      isFresh = latestBackupAgeHours <= this.backupMaxAgeHours;
    }

    if (!latestBackup) {
      warnings.push('no_backup_found');
    } else if (!isFresh) {
      warnings.push('latest_backup_is_stale');
    }
    if (!restoreDrill.lastRestoreDrillAt) {
      warnings.push('restore_drill_never_ran');
    } else if (restoreDrill.isDue) {
      warnings.push('restore_drill_overdue');
    }
    if (toNumber(lockRow?.waiting) > 0) {
      warnings.push('waiting_locks_detected');
    }
    if (toNumber(lockRow?.longRunning) > 0) {
      warnings.push('long_running_locks_detected');
    }

    return {
      enabled: true,
      driver: 'postgres',
      status: warnings.length > 0 ? 'warn' : 'ok',
      version: versionRow?.version ?? null,
      sizeBytes: sizeRow ? toNumber(sizeRow.sizeBytes) : null,
      connections: {
        total: toNumber(connectionRow?.total),
        active: toNumber(connectionRow?.active),
        idle: toNumber(connectionRow?.idle),
      },
      locks: {
        waiting: toNumber(lockRow?.waiting),
        longRunning: toNumber(lockRow?.longRunning),
      },
      backups: {
        latestBackupFile: latestBackup?.fileName ?? null,
        latestBackupAt: latestBackup?.modifiedAt.toISOString() ?? null,
        latestBackupAgeHours,
        maxAgeHours: this.backupMaxAgeHours,
        isFresh,
        backupDirectoryConfigured: Boolean(this.backupDir),
      },
      restoreDrill,
      warnings,
    };
  }
}
