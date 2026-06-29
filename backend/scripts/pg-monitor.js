/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const {
  listBackupFiles,
  readPositiveInteger,
  resolveBackupDir,
  resolveDatabaseUrl,
} = require('./pg-utils');

function parseArgs(argv) {
  return { strict: argv.includes('--strict') };
}

function readOpsState(backupDir) {
  const stateFilePath = path.join(backupDir, '.pg-ops-state.json');
  try {
    if (!fs.existsSync(stateFilePath)) return { state: {}, stateFilePresent: false };
    return {
      state: JSON.parse(fs.readFileSync(stateFilePath, 'utf8')),
      stateFilePresent: true,
    };
  } catch {
    return { state: {}, stateFilePresent: false };
  }
}

function hoursSince(date) {
  return Number(((Date.now() - date.getTime()) / (1000 * 60 * 60)).toFixed(2));
}

function daysSinceIso(isoDate) {
  if (!isoDate) return null;
  const time = new Date(isoDate).getTime();
  if (!Number.isFinite(time)) return null;
  return Number(((Date.now() - time) / (1000 * 60 * 60 * 24)).toFixed(2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
  const backupDir = resolveBackupDir(process.env.PG_BACKUP_DIR);
  const maxBackupAgeHours = readPositiveInteger(process.env.PG_BACKUP_MAX_AGE_HOURS, 24);
  const restoreDrillFrequencyDays = readPositiveInteger(process.env.PG_RESTORE_DRILL_FREQUENCY_DAYS, 7);
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const warnings = [];

  try {
    await client.$connect();
    const [sizeRow] = await client.$queryRawUnsafe(
      'SELECT pg_database_size(current_database()) AS "sizeBytes";',
    );
    const [connectionRow] = await client.$queryRawUnsafe(
      "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE state = 'active')::int AS active, COUNT(*) FILTER (WHERE state = 'idle')::int AS idle FROM pg_stat_activity WHERE datname = current_database();",
    );
    const [lockRow] = await client.$queryRawUnsafe(
      "SELECT COUNT(*) FILTER (WHERE NOT granted)::int AS waiting, COUNT(*) FILTER (WHERE granted AND now() - COALESCE(query_start, now()) > interval '5 minutes')::int AS \"longRunning\" FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid = l.pid WHERE a.datname = current_database();",
    );

    const latestBackup = listBackupFiles(backupDir)[0] || null;
    const latestBackupAgeHours = latestBackup ? hoursSince(latestBackup.mtime) : null;
    if (!latestBackup) warnings.push('no_backup_found');
    if (latestBackupAgeHours !== null && latestBackupAgeHours > maxBackupAgeHours) {
      warnings.push('latest_backup_is_stale');
    }
    if (Number(lockRow?.waiting ?? 0) > 0) warnings.push('waiting_locks_detected');
    if (Number(lockRow?.longRunning ?? 0) > 0) warnings.push('long_running_locks_detected');

    const { state, stateFilePresent } = readOpsState(backupDir);
    const restoreDrillAgeDays = daysSinceIso(state.lastRestoreDrillAt);
    if (!state.lastRestoreDrillAt) warnings.push('restore_drill_never_ran');
    if (restoreDrillAgeDays !== null && restoreDrillAgeDays > restoreDrillFrequencyDays) {
      warnings.push('restore_drill_overdue');
    }

    const payload = {
      event: 'postgres_monitor_status',
      status: warnings.length > 0 ? 'warn' : 'ok',
      databaseSizeBytes: Number(sizeRow?.sizeBytes ?? 0),
      connections: connectionRow || { total: 0, active: 0, idle: 0 },
      locks: lockRow || { waiting: 0, longRunning: 0 },
      backupDir,
      latestBackupFile: latestBackup?.name ?? null,
      latestBackupAgeHours,
      maxBackupAgeHours,
      restoreDrill: {
        lastRestoreDrillAt: state.lastRestoreDrillAt || null,
        lastRestoreDrillAgeDays: restoreDrillAgeDays,
        frequencyDays: restoreDrillFrequencyDays,
        stateFilePresent,
      },
      warnings,
    };

    console.log(JSON.stringify(payload));
    if (args.strict && warnings.length > 0) process.exit(1);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'postgres_monitor_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
