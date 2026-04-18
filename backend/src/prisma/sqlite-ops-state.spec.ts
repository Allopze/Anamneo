import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSqliteRestoreDrillStatus } from './sqlite-ops-state';

describe('readSqliteRestoreDrillStatus', () => {
  it('marks the restore drill as due when the state file is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-sqlite-ops-'));

    expect(readSqliteRestoreDrillStatus(tempDir, 7)).toEqual({
      lastRestoreDrillAt: null,
      lastRestoreDrillAgeDays: null,
      frequencyDays: 7,
      isDue: true,
      stateFilePresent: false,
    });
  });

  it('reads the latest restore drill timestamp from the ops state file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-sqlite-ops-'));
    const lastRestoreDrillAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    fs.writeFileSync(
      path.join(tempDir, '.sqlite-ops-state.json'),
      JSON.stringify({ lastRestoreDrillAt }, null, 2),
      'utf8',
    );

    const result = readSqliteRestoreDrillStatus(tempDir, 7);

    expect(result.lastRestoreDrillAt).toBe(lastRestoreDrillAt);
    expect(result.lastRestoreDrillAgeDays).toBeGreaterThanOrEqual(1.9);
    expect(result.lastRestoreDrillAgeDays).toBeLessThan(2.1);
    expect(result.frequencyDays).toBe(7);
    expect(result.isDue).toBe(false);
    expect(result.stateFilePresent).toBe(true);
  });
});