import * as fs from 'fs';
import * as path from 'path';

const POSTGRES_OPS_STATE_FILE = '.pg-ops-state.json';

type OpsState = {
  lastBackupAt?: string;
  lastRestoreDrillAt?: string;
  lastMonitorAt?: string;
};

function readOpsState(backupDir: string): { state: OpsState; stateFilePresent: boolean } {
  const stateFilePath = path.join(backupDir, POSTGRES_OPS_STATE_FILE);
  try {
    if (!fs.existsSync(stateFilePath)) {
      return { state: {}, stateFilePresent: false };
    }
    return {
      state: JSON.parse(fs.readFileSync(stateFilePath, 'utf8')) as OpsState,
      stateFilePresent: true,
    };
  } catch {
    return { state: {}, stateFilePresent: false };
  }
}

function ageInDays(isoDate: string | undefined): number | null {
  if (!isoDate) return null;
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Number(((Date.now() - timestamp) / (1000 * 60 * 60 * 24)).toFixed(2));
}

export function readPostgresRestoreDrillStatus(
  backupDir: string,
  frequencyDays: number,
) {
  const { state, stateFilePresent } = readOpsState(backupDir);
  const lastRestoreDrillAgeDays = ageInDays(state.lastRestoreDrillAt);

  return {
    lastRestoreDrillAt: state.lastRestoreDrillAt ?? null,
    lastRestoreDrillAgeDays,
    frequencyDays,
    isDue: lastRestoreDrillAgeDays !== null && lastRestoreDrillAgeDays > frequencyDays,
    stateFilePresent,
  };
}
