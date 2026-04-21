const { existsSync, readFileSync } = require('node:fs');

function parseProcStat(statLine) {
  const closingParenIndex = statLine.lastIndexOf(')');
  if (closingParenIndex === -1) {
    return null;
  }

  const fields = statLine.slice(closingParenIndex + 2).trim().split(/\s+/);
  if (fields.length < 4) {
    return null;
  }

  return {
    parentPid: Number.parseInt(fields[1], 10),
    sessionLeaderPid: Number.parseInt(fields[3], 10),
  };
}

function readProcessIdentity(pid = process.pid) {
  const identity = {
    parentPid: process.ppid,
    sessionLeaderPid: null,
  };

  if (process.platform !== 'linux') {
    return identity;
  }

  try {
    const statLine = readFileSync(`/proc/${pid}/stat`, 'utf8').trim();
    const parsed = parseProcStat(statLine);

    if (parsed?.parentPid) {
      identity.parentPid = parsed.parentPid;
    }

    if (parsed?.sessionLeaderPid) {
      identity.sessionLeaderPid = parsed.sessionLeaderPid;
    }
  } catch {
    return identity;
  }

  return identity;
}

function installProcessGuard({ onParentGone, pollIntervalMs = 1000 }) {
  const identity = readProcessIdentity();
  let hasTriggered = false;

  const trigger = (reason) => {
    if (hasTriggered) {
      return;
    }

    hasTriggered = true;
    onParentGone(reason, identity);
  };

  const interval = setInterval(() => {
    if (identity.parentPid > 1 && process.ppid !== identity.parentPid) {
      trigger(`parent ${identity.parentPid} exited`);
      return;
    }

    if (
      process.platform === 'linux'
      && identity.sessionLeaderPid
      && identity.sessionLeaderPid > 1
      && !existsSync(`/proc/${identity.sessionLeaderPid}`)
    ) {
      trigger(`session leader ${identity.sessionLeaderPid} exited`);
    }
  }, pollIntervalMs);

  interval.unref();
  process.on('disconnect', () => {
    trigger('ipc disconnected');
  });

  return identity;
}

module.exports = {
  installProcessGuard,
  readProcessIdentity,
};
