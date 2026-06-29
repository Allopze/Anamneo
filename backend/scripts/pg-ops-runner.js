/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readPositiveInteger, resolveBackupDir } = require('./pg-utils');

const STATE_FILE_NAME = '.pg-ops-state.json';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_ALERT_OUTPUT_LENGTH = 4000;

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const directMatch = process.argv.find((arg) => arg.startsWith(prefix));
  if (directMatch) return directMatch.slice(prefix.length).trim();
  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) return process.argv[flagIndex + 1].trim();
  return fallback;
}

function toBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync('node', [path.join('scripts', scriptName), ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return { name: scriptName, args, exitCode, ok: exitCode === 0, output };
}

function readOpsState(stateFilePath) {
  try {
    if (!fs.existsSync(stateFilePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeOpsState(stateFilePath, state) {
  fs.writeFileSync(`${stateFilePath}.tmp`, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(`${stateFilePath}.tmp`, stateFilePath);
}

function isRestoreDrillDue(lastRestoreDrillAt, frequencyDays) {
  if (!lastRestoreDrillAt) return true;
  const lastTime = new Date(lastRestoreDrillAt).getTime();
  return !Number.isFinite(lastTime) || Date.now() - lastTime >= frequencyDays * DAY_IN_MS;
}

function buildAuditIntegrityArgs() {
  const scope = (readArg('audit-integrity', process.env.PG_AUDIT_INTEGRITY_SCOPE || 'recent') || 'recent').toLowerCase();
  if (scope === 'full') return ['--full'];
  const limit = readPositiveInteger(readArg('audit-integrity-limit', process.env.PG_AUDIT_INTEGRITY_LIMIT), 1000);
  return [`--limit=${limit}`];
}

function buildClinicalSearchArgs() {
  const action = (readArg('clinical-search', process.env.PG_CLINICAL_SEARCH_ACTION || 'dry-run') || 'dry-run').toLowerCase();
  if (action === 'rebuild') return [];
  if (action === 'dry-run') return ['--dry-run'];
  throw new Error('Clinical search invalido. Usa --clinical-search=dry-run|rebuild');
}

function getScriptsByMode(mode, shouldRunDrill, auditIntegrityArgs, clinicalSearchArgs) {
  if (mode === 'backup') return [{ script: 'pg-backup.js', stateField: 'lastBackupAt' }];
  if (mode === 'mirror') return [{ script: 'pg-backup-mirror.js', stateField: 'lastBackupMirrorAt' }];
  if (mode === 'restore-drill') return [{ script: 'pg-restore-drill.js', stateField: 'lastRestoreDrillAt' }];
  if (mode === 'monitor') return [{ script: 'pg-monitor.js', args: ['--strict'], stateField: 'lastMonitorAt' }];
  if (mode === 'integrity') return [{ script: 'verify-audit-integrity.js', args: auditIntegrityArgs, stateField: 'lastAuditIntegrityAt' }];
  if (mode === 'clinical-search') {
    return [{
      script: 'rebuild-patient-clinical-search.js',
      args: clinicalSearchArgs,
      stateField: clinicalSearchArgs.includes('--dry-run')
        ? 'lastClinicalSearchProjectionCheckAt'
        : 'lastClinicalSearchProjectionRebuildAt',
    }];
  }

  return [
    { script: 'pg-backup.js', stateField: 'lastBackupAt' },
    // Off-machine mirror (no-op unless PG_BACKUP_MIRROR_DIR is set) — runs right after the
    // fresh dump so the latest backup is copied off-host on every cycle.
    { script: 'pg-backup-mirror.js', stateField: 'lastBackupMirrorAt' },
    ...(shouldRunDrill ? [{ script: 'pg-restore-drill.js', stateField: 'lastRestoreDrillAt' }] : []),
    { script: 'pg-monitor.js', args: ['--strict'], stateField: 'lastMonitorAt' },
    { script: 'verify-audit-integrity.js', args: auditIntegrityArgs, stateField: 'lastAuditIntegrityAt' },
  ];
}

function truncateOutput(value) {
  return value.length <= MAX_ALERT_OUTPUT_LENGTH ? value : `${value.slice(0, MAX_ALERT_OUTPUT_LENGTH)}...`;
}

function formatAlertPayload(payload) {
  const lines = [
    `Anamneo PostgreSQL alerta: ${payload.status.toUpperCase()}`,
    `Servicio: ${payload.service}`,
    `Modo: ${payload.mode}`,
    `Politica de notificacion: ${payload.notifyPolicy}`,
  ];
  if (payload.backupDir) lines.push(`Backup dir: ${payload.backupDir}`);
  const failedTasks = (payload.tasks || []).filter((task) => task.status === 'failed');
  if (failedTasks.length > 0) {
    lines.push('Fallos detectados:');
    failedTasks.forEach((task) => lines.push(`- ${task.name} (exit ${task.exitCode}): ${task.output || 'sin salida'}`));
  }
  return { ...payload, content: lines.join('\n'), text: lines.join('\n') };
}

async function sendAlertWebhook(payload) {
  const webhookUrl = process.env.PG_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return { sent: false, reason: 'webhook_not_configured' };
  const fetchFn = typeof global.fetch === 'function' ? global.fetch.bind(global) : null;
  if (!fetchFn) return { sent: false, reason: 'fetch_unavailable' };
  try {
    const response = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(formatAlertPayload(payload)),
    });
    return response.ok
      ? { sent: true, status: response.status }
      : { sent: false, status: response.status, reason: await response.text().catch(() => 'webhook_failed') };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'webhook_failed' };
  }
}

async function main() {
  const mode = (readArg('mode', 'all') || 'all').toLowerCase();
  const notifyPolicy = (readArg('notify', process.env.PG_NOTIFY_POLICY || 'on-failure') || 'on-failure').toLowerCase();
  const forceRestoreDrill = toBoolean(readArg('force-restore-drill', process.env.PG_FORCE_RESTORE_DRILL));
  if (!['all', 'backup', 'mirror', 'restore-drill', 'monitor', 'integrity', 'clinical-search'].includes(mode)) {
    throw new Error('Modo invalido. Usa --mode=all|backup|mirror|restore-drill|monitor|integrity|clinical-search');
  }

  const backupDir = resolveBackupDir(process.env.PG_BACKUP_DIR);
  fs.mkdirSync(backupDir, { recursive: true });
  const stateFilePath = path.join(backupDir, STATE_FILE_NAME);
  const state = readOpsState(stateFilePath);
  const restoreDrillFrequencyDays = readPositiveInteger(process.env.PG_RESTORE_DRILL_FREQUENCY_DAYS, 7);
  const shouldRunDrill = forceRestoreDrill
    || mode === 'restore-drill'
    || isRestoreDrillDue(state.lastRestoreDrillAt, restoreDrillFrequencyDays);
  const scripts = getScriptsByMode(
    mode,
    shouldRunDrill,
    buildAuditIntegrityArgs(),
    buildClinicalSearchArgs(),
  );

  const tasks = [];
  let ok = true;
  for (const task of scripts) {
    const result = runNodeScript(task.script, task.args || []);
    if (result.ok) {
      state[task.stateField] = new Date().toISOString();
      state.restoreDrillFrequencyDays = restoreDrillFrequencyDays;
      writeOpsState(stateFilePath, state);
    } else {
      ok = false;
    }
    tasks.push({
      name: task.script,
      args: result.args,
      status: result.ok ? 'passed' : 'failed',
      exitCode: result.exitCode,
      output: truncateOutput(result.output),
    });
  }
  state.restoreDrillFrequencyDays = restoreDrillFrequencyDays;
  writeOpsState(stateFilePath, state);

  const payload = {
    event: 'postgres_ops_runner_completed',
    status: ok ? 'ok' : 'failed',
    service: process.env.PG_ALERT_SERVICE_NAME || 'anamneo-backend',
    mode,
    notifyPolicy,
    backupDir,
    restoreDrillFrequencyDays,
    tasks,
  };
  const shouldNotify = notifyPolicy === 'always' || (notifyPolicy === 'on-failure' && !ok);
  const alert = shouldNotify ? await sendAlertWebhook(payload) : { sent: false, reason: 'policy' };
  console.log(JSON.stringify({ ...payload, alert }));
  if (!ok) process.exit(1);
}

main().catch(async (error) => {
  const payload = {
    event: 'postgres_ops_runner_failed',
    status: 'failed',
    service: process.env.PG_ALERT_SERVICE_NAME || 'anamneo-backend',
    mode: readArg('mode', 'all'),
    notifyPolicy: readArg('notify', process.env.PG_NOTIFY_POLICY || 'on-failure'),
    message: error instanceof Error ? error.message : 'unknown_error',
  };
  const alert = payload.notifyPolicy !== 'never'
    ? await sendAlertWebhook(payload)
    : { sent: false, reason: 'policy' };
  console.error(JSON.stringify({ ...payload, alert }));
  process.exit(1);
});
