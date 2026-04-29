#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const appRoot = path.resolve(__dirname, '..');
const nextRoot = path.join(appRoot, '.next');

const budgets = [
  { route: '/login', html: 'login.html', gzipKiB: 320 },
  { route: '/pacientes', html: 'pacientes.html', gzipKiB: 330 },
  { route: '/atenciones', html: 'atenciones.html', gzipKiB: 330 },
  { route: '/atenciones/nueva', html: 'atenciones/nueva.html', gzipKiB: 320 },
];

function formatKiB(bytes) {
  return `${Math.round(bytes / 1024)} KiB`;
}

function getRouteChunkRefs(html) {
  return [...new Set([...html.matchAll(/\/static\/chunks\/[^"']+\.js/g)].map((match) => match[0]))];
}

function measureRoute(htmlFile) {
  const htmlPath = path.join(nextRoot, 'server', 'app', htmlFile);
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`No existe ${path.relative(appRoot, htmlPath)}. Ejecuta npm run build primero.`);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const chunkRefs = getRouteChunkRefs(html);
  let rawBytes = 0;
  let gzipBytes = 0;

  for (const chunkRef of chunkRefs) {
    const chunkPath = path.join(nextRoot, chunkRef.replace(/^\//, ''));
    if (!fs.existsSync(chunkPath)) continue;

    const bytes = fs.readFileSync(chunkPath);
    rawBytes += bytes.length;
    gzipBytes += zlib.gzipSync(bytes).length;
  }

  return { chunkCount: chunkRefs.length, rawBytes, gzipBytes };
}

let failed = false;

for (const budget of budgets) {
  const measurement = measureRoute(budget.html);
  const limitBytes = budget.gzipKiB * 1024;
  const passed = measurement.gzipBytes <= limitBytes;
  failed ||= !passed;

  const status = passed ? 'OK' : 'EXCEDE';
  console.log(
    `${status} ${budget.route}: ${formatKiB(measurement.gzipBytes)} gzip / ${budget.gzipKiB} KiB ` +
      `(${formatKiB(measurement.rawBytes)} raw, ${measurement.chunkCount} chunks)`,
  );
}

if (failed) {
  process.exitCode = 1;
}
