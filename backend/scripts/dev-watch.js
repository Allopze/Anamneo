const { existsSync } = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const entryPoint = path.join(backendRoot, 'dist', 'backend', 'src', 'main.js');

const args = new Set(process.argv.slice(2));
const shouldMigrate = args.has('--migrate');
const shouldInspect = args.has('--inspect');

let buildProcess = null;
let serverProcess = null;
let isStopping = false;
let pendingRestart = false;
let buildBuffer = '';
const MAX_BUILD_BUFFER_CHARS = 200_000;

function runOrExit(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function forwardOutput(stream, target) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    target.write(text);
    buildBuffer = `${buildBuffer}${text}`.slice(-MAX_BUILD_BUFFER_CHARS);
    maybeRestartServer();
  });
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill('SIGTERM');
}

function startServer() {
  if (!existsSync(entryPoint)) {
    return;
  }

  const nodeArgs = [];
  if (shouldInspect) {
    nodeArgs.push('--inspect');
  }
  nodeArgs.push(entryPoint);

  serverProcess = spawn(process.execPath, nodeArgs, {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  });

  serverProcess.on('exit', (code, signal) => {
    if (isStopping) {
      return;
    }

    if (signal) {
      return;
    }

    if (code !== 0) {
      console.error(`[dev-watch] Backend process exited with code ${code}. Waiting for next successful rebuild...`);
    }
  });
}

function restartServer() {
  pendingRestart = false;

  if (serverProcess && serverProcess.exitCode === null && !serverProcess.killed) {
    const previousServer = serverProcess;
    serverProcess = null;

    previousServer.once('exit', () => {
      if (!isStopping) {
        startServer();
      }
    });

    stopChild(previousServer);
    return;
  }

  startServer();
}

function maybeRestartServer() {
  if (pendingRestart) {
    return;
  }

  if (!/Found 0 errors\. Watching for file changes\./.test(buildBuffer)) {
    return;
  }

  buildBuffer = '';
  pendingRestart = true;
  restartServer();
}

function shutdown(code = 0) {
  if (isStopping) {
    return;
  }

  isStopping = true;
  stopChild(serverProcess);
  stopChild(buildProcess);

  const maybeExit = () => process.exit(code);

  if (serverProcess && serverProcess.exitCode === null && !serverProcess.killed) {
    serverProcess.once('exit', maybeExit);
  } else if (buildProcess && buildProcess.exitCode === null && !buildProcess.killed) {
    buildProcess.once('exit', maybeExit);
  } else {
    maybeExit();
  }
}

if (shouldMigrate) {
  runOrExit(npmCommand, ['run', 'prisma:migrate:prod']);
}

buildProcess = spawn(npmCommand, ['run', 'build', '--', '--watch'], {
  cwd: backendRoot,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

forwardOutput(buildProcess.stdout, process.stdout);
forwardOutput(buildProcess.stderr, process.stderr);

buildProcess.on('exit', (code, signal) => {
  if (isStopping) {
    return;
  }

  if (signal) {
    shutdown(0);
    return;
  }

  shutdown(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(0));
}
