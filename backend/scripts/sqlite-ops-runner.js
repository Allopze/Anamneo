/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  resolveSqliteDatabasePath,
  resolveBackupDir,
  readPositiveInteger,
} = require('./sqlite-utils');

const STATE_FILE_NAME = '.sqlite-ops-state.json';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_ALERT_OUTPUT_LENGTH = 4000;

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const directMatch = process.argv.find((arg) => arg.startsWith(prefix));
  if (directMatch) {
    return directMatch.slice(prefix.length).trim();
  }

  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1].trim();
  }

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

  return {
    name: scriptName,
    args,
    exitCode,
    ok: exitCode === 0,
    output,
  };
}

function readOpsState(stateFilePath) {
  try {
    if (!fs.existsSync(stateFilePath)) {
      return {};
    }

    const parsed = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }

    return {};
  } catch {
    return {};
  }
}

function writeOpsState(stateFilePath, state) {
  fs.writeFileSync(`${stateFilePath}.tmp`, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(`${stateFilePath}.tmp`, stateFilePath);
}

function isRestoreDrillDue(lastRestoreDrillAt, frequencyDays) {
  if (!lastRestoreDrillAt) {
    return true;
  }

  const lastTime = new Date(lastRestoreDrillAt).getTime();
  if (!Number.isFinite(lastTime)) {
    return true;
  }

  return Date.now() - lastTime >= frequencyDays * DAY_IN_MS;
}

function getScriptsByMode(mode, shouldRunDrill) {
  if (mode === 'backup') {
    return [
      { script: 'sqlite-backup.js', stateField: 'lastBackupAt' },
    ];
  }

  if (mode === 'restore-drill') {
    return [
      { script: 'sqlite-restore-drill.js', stateField: 'lastRestoreDrillAt' },
    ];
  }

  if (mode === 'monitor') {
    return [
      { script: 'sqlite-monitor.js', args: ['--strict'], stateField: 'lastMonitorAt' },
    ];
  }

  const tasks = [
    { script: 'sqlite-backup.js', stateField: 'lastBackupAt' },
    ...(shouldRunDrill ? [{ script: 'sqlite-restore-drill.js', stateField: 'lastRestoreDrillAt' }] : []),
    { script: 'sqlite-monitor.js', args: ['--strict'], stateField: 'lastMonitorAt' },
  ];

  return tasks;
}

function truncateOutput(value) {
  if (value.length <= MAX_ALERT_OUTPUT_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_ALERT_OUTPUT_LENGTH)}...`;
}

function formatAlertPayload(payload) {
  const lines = [
    `Anamneo SQLite alerta: ${payload.status.toUpperCase()}`,
    `Servicio: ${payload.service}`,
    `Modo: ${payload.mode}`,
    `Politica de notificacion: ${payload.notifyPolicy}`,
  ];

  if (payload.backupDir) {
    lines.push(`Backup dir: ${payload.backupDir}`);
  }

  const failedTasks = (payload.tasks || []).filter((task) => task.status === 'failed');
  if (failedTasks.length > 0) {
    lines.push('Fallos detectados:');
    failedTasks.forEach((task) => {
      lines.push(`- ${task.name} (exit ${task.exitCode}): ${task.output || 'sin salida'}`);
    });
  }

  return {
    ...payload,
    content: lines.join('\n'),
    text: lines.join('\n'),
  };
}

async function sendAlertWebhook(payload) {
  const webhookUrl = process.env.SQLITE_ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return { sent: false, reason: 'webhook_not_configured' };
  }

  const fetchFn = typeof global.fetch === 'function'
    ? global.fetch.bind(global)
    : null;
  if (!fetchFn) {
    return { sent: false, reason: 'fetch_unavailable' };
  }

  try {
    const response = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(formatAlertPayload(payload)),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        sent: false,
        reason: 'http_error',
        status: response.status,
        body: truncateOutput(text || ''),
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: 'request_failed',
      message: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

async function main() {
  const mode = (readArg('mode', 'all') || 'all').toLowerCase();
  const notifyPolicy = (readArg('notify', process.env.SQLITE_NOTIFY_POLICY || 'on-failure') || 'on-failure').toLowerCase();
  const forceRestoreDrill = toBoolean(readArg('force-restore-drill', process.env.SQLITE_FORCE_RESTORE_DRILL));

  if (!['all', 'backup', 'restore-drill', 'monitor'].includes(mode)) {
    throw new Error('Modo invalido. Usa --mode=all|backup|restore-drill|monitor');
  }
  if (!['on-failure', 'always', 'never'].includes(notifyPolicy)) {
    throw new Error('Notify invalido. Usa --notify=on-failure|always|never');
  }

  const restoreDrillFrequencyDays = readPositiveInteger(process.env.SQLITE_RESTORE_DRILL_FREQUENCY_DAYS, 7);

  const dbPath = resolveSqliteDatabasePath(process.env.DATABASE_URL);
  const backupDir = resolveBackupDir(dbPath, process.env.SQLITE_BACKUP_DIR);
  fs.mkdirSync(backupDir, { recursive: true });

  const stateFilePath = path.join(backupDir, STATE_FILE_NAME);
  const state = readOpsState(stateFilePath);
  const shouldRunDrill = forceRestoreDrill
    || mode === 'restore-drill'
    || isRestoreDrillDue(state.lastRestoreDrillAt, restoreDrillFrequencyDays);

  const tasks = getScriptsByMode(mode, shouldRunDrill);
  const taskResults = [];

  for (const task of tasks) {
    const result = runNodeScript(task.script, task.args || []);
    taskResults.push(result);

    if (result.ok && task.stateField) {
      state[task.stateField] = new Date().toISOString();
    }

    if (!result.ok) {
      break;
    }
  }

  state.lastRunAt = new Date().toISOString();
  state.lastMode = mode;
  state.restoreDrillFrequencyDays = restoreDrillFrequencyDays;
  writeOpsState(stateFilePath, state);

  const hasFailures = taskResults.some((task) => !task.ok);
  const summary = {
    event: 'sqlite_ops_runner_completed',
    service: process.env.SQLITE_ALERT_SERVICE_NAME || 'anamneo-backend',
    mode,
    notifyPolicy,
    forceRestoreDrill,
    restoreDrillFrequencyDays,
    shouldRunDrill,
    status: hasFailures ? 'failed' : 'ok',
    backupDir,
    stateFilePath,
    tasks: taskResults.map((task) => ({
      name: task.name,
      args: task.args,
      status: task.ok ? 'ok' : 'failed',
      exitCode: task.exitCode,
      output: truncateOutput(task.output),
    })),
  };

  const shouldNotify = notifyPolicy === 'always' || (notifyPolicy === 'on-failure' && hasFailures);
  if (shouldNotify) {
    const webhookResult = await sendAlertWebhook(summary);
    summary.alert = webhookResult;
  }

  if (hasFailures) {
    console.error(JSON.stringify(summary));
    process.exit(1);
  }

  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'sqlite_ops_runner_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
