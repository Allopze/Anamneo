import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readPostgresRestoreDrillStatus } from './postgres-ops-state';

describe('readPostgresRestoreDrillStatus', () => {
  it('reports missing state as no restore drill', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-pg-ops-'));

    try {
      expect(readPostgresRestoreDrillStatus(tempDir, 7)).toEqual({
        lastRestoreDrillAt: null,
        lastRestoreDrillAgeDays: null,
        frequencyDays: 7,
        isDue: false,
        stateFilePresent: false,
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reads restore drill timestamps from the Postgres ops state file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-pg-ops-'));
    const lastRestoreDrillAt = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();

    try {
      fs.writeFileSync(
        path.join(tempDir, '.pg-ops-state.json'),
        JSON.stringify({ lastRestoreDrillAt }),
      );

      const result = readPostgresRestoreDrillStatus(tempDir, 7);

      expect(result.lastRestoreDrillAt).toBe(lastRestoreDrillAt);
      expect(result.lastRestoreDrillAgeDays).toBeGreaterThanOrEqual(8.9);
      expect(result.frequencyDays).toBe(7);
      expect(result.isDue).toBe(true);
      expect(result.stateFilePresent).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
