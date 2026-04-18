import * as fs from 'fs';
import * as path from 'path';

const SQLITE_OPS_STATE_FILE = '.sqlite-ops-state.json';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type SqliteOpsState = {
  lastRestoreDrillAt?: string;
};

export type SqliteRestoreDrillStatus = {
  lastRestoreDrillAt: string | null;
  lastRestoreDrillAgeDays: number | null;
  frequencyDays: number;
  isDue: boolean;
  stateFilePresent: boolean;
};

function readOpsStateFile(filePath: string): SqliteOpsState | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    return parsed as SqliteOpsState;
  } catch {
    return null;
  }
}

function readIsoDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function readSqliteRestoreDrillStatus(
  backupDir: string,
  frequencyDays: number,
): SqliteRestoreDrillStatus {
  const stateFilePath = path.join(backupDir, SQLITE_OPS_STATE_FILE);
  const rawState = readOpsStateFile(stateFilePath);
  const lastRestoreDrillAt = readIsoDate(rawState?.lastRestoreDrillAt);

  if (!lastRestoreDrillAt) {
    return {
      lastRestoreDrillAt: null,
      lastRestoreDrillAgeDays: null,
      frequencyDays,
      isDue: true,
      stateFilePresent: Boolean(rawState),
    };
  }

  const ageDays = Number(
    ((Date.now() - new Date(lastRestoreDrillAt).getTime()) / DAY_IN_MS).toFixed(2),
  );

  return {
    lastRestoreDrillAt,
    lastRestoreDrillAgeDays: ageDays,
    frequencyDays,
    isDue: ageDays >= frequencyDays,
    stateFilePresent: true,
  };
}