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
  {
    route: '/pacientes/[id]',
    manifest: '(dashboard)/pacientes/[id]/page_client-reference-manifest.js',
    gzipKiB: 190,
  },
  {
    route: '/atenciones/[id]',
    manifest: '(dashboard)/atenciones/[id]/page_client-reference-manifest.js',
    gzipKiB: 180,
  },
  {
    route: '/atenciones/[id]/ficha',
    manifest: '(dashboard)/atenciones/[id]/ficha/page_client-reference-manifest.js',
    gzipKiB: 170,
  },
];

function formatKiB(bytes) {
  return `${Math.round(bytes / 1024)} KiB`;
}

function getRouteChunkRefs(html) {
  return [...new Set([...html.matchAll(/\/static\/chunks\/[^"']+\.js/g)].map((match) => match[0]))];
}

function measureChunks(chunkRefs) {
  let rawBytes = 0;
  let gzipBytes = 0;
  const uniqueChunkRefs = [...new Set(chunkRefs)];

  for (const chunkRef of uniqueChunkRefs) {
    const chunkPath = path.join(nextRoot, chunkRef.replace(/^\/_next\//, '').replace(/^\//, ''));
    if (!fs.existsSync(chunkPath)) continue;

    const bytes = fs.readFileSync(chunkPath);
    rawBytes += bytes.length;
    gzipBytes += zlib.gzipSync(bytes).length;
  }

  return { chunkCount: uniqueChunkRefs.length, rawBytes, gzipBytes };
}

function measureHtmlRoute(htmlFile) {
  const htmlPath = path.join(nextRoot, 'server', 'app', htmlFile);
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`No existe ${path.relative(appRoot, htmlPath)}. Ejecuta npm run build primero.`);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  return { ...measureChunks(getRouteChunkRefs(html)), source: 'html' };
}

function readClientReferenceManifest(manifestFile) {
  const manifestPath = path.join(nextRoot, 'server', 'app', manifestFile);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No existe ${path.relative(appRoot, manifestPath)}. Ejecuta npm run build primero.`);
  }

  const source = fs.readFileSync(manifestPath, 'utf8');
  const assignmentIndex = source.lastIndexOf(' = ');
  if (assignmentIndex === -1) {
    throw new Error(`No se pudo leer el manifest ${path.relative(appRoot, manifestPath)}.`);
  }

  const jsonText = source.slice(assignmentIndex + 3).trim().replace(/;$/, '');
  return JSON.parse(jsonText);
}

function measureManifestRoute(manifestFile) {
  const manifest = readClientReferenceManifest(manifestFile);
  const chunkRefs = Object.values(manifest.clientModules ?? {}).flatMap((moduleRef) => moduleRef.chunks ?? []);
  return { ...measureChunks(chunkRefs), source: 'manifest' };
}

function measureRoute(budget) {
  if (budget.html) return measureHtmlRoute(budget.html);
  if (budget.manifest) return measureManifestRoute(budget.manifest);
  throw new Error(`Budget invalido para ${budget.route}.`);
}

let failed = false;

for (const budget of budgets) {
  const measurement = measureRoute(budget);
  const limitBytes = budget.gzipKiB * 1024;
  const passed = measurement.gzipBytes <= limitBytes;
  failed ||= !passed;

  const status = passed ? 'OK' : 'EXCEDE';
  console.log(
    `${status} ${budget.route}: ${formatKiB(measurement.gzipBytes)} gzip / ${budget.gzipKiB} KiB ` +
      `(${formatKiB(measurement.rawBytes)} raw, ${measurement.chunkCount} chunks, ${measurement.source})`,
  );
}

if (failed) {
  process.exitCode = 1;
}
