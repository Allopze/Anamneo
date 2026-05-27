#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src');

const DOMAIN_REQUIREMENTS = [
  {
    controller: 'alerts/alerts.controller.ts',
    evidence: ['alerts/alerts.service.ts'],
    required: ['assertPatientAccess'],
  },
  {
    controller: 'consents/consents.controller.ts',
    evidence: ['consents/consents.service.ts'],
    required: ['assertPatientAccess'],
  },
  {
    controller: 'patient-consents/patient-consents.controller.ts',
    evidence: ['patient-consents/patient-consents.service.ts'],
    required: ['assertPatientAccess', 'assertLoadedPatientAccess'],
  },
  {
    controller: 'encounters/encounters.controller.ts',
    evidence: [
      'encounters/encounters.service.ts',
      'encounters/encounters-create-mutation.ts',
      'encounters/encounters-read-side.ts',
    ],
    required: ['getEffectiveMedicoId', 'medicoId'],
  },
  {
    controller: 'patient-portal/patient-portal.controller.ts',
    evidence: ['patient-portal/patient-portal.controller.ts'],
    required: ['AdminGuard'],
  },
  {
    controller: 'allergies/allergies.controller.ts',
    evidence: ['allergies/allergies.service.ts'],
    required: ['assertPatientAccess'],
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function getControllerFiles(dir = srcRoot) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return getControllerFiles(fullPath);
    if (!entry.name.endsWith('.controller.ts')) return [];
    return [path.relative(srcRoot, fullPath)];
  });
}

const controllersWithPatientId = getControllerFiles()
  .filter((file) => /\bpatientId\b/.test(read(file)))
  .sort();

const expectedControllers = DOMAIN_REQUIREMENTS.map((item) => item.controller).sort();
const unexpected = controllersWithPatientId.filter((file) => !expectedControllers.includes(file));
const missing = expectedControllers.filter((file) => !controllersWithPatientId.includes(file));

const failures = [];

if (unexpected.length > 0) {
  failures.push(`Controladores nuevos con patientId sin contrato de scope: ${unexpected.join(', ')}`);
}

if (missing.length > 0) {
  failures.push(`Contratos obsoletos, controlador ya no contiene patientId: ${missing.join(', ')}`);
}

for (const requirement of DOMAIN_REQUIREMENTS) {
  const evidence = requirement.evidence.map(read).join('\n');
  const hasEvidence = requirement.required.some((token) => evidence.includes(token));
  if (!hasEvidence) {
    failures.push(
      `${requirement.controller} no muestra evidencia estatica de scope (${requirement.required.join(' o ')})`,
    );
  }
}

if (failures.length > 0) {
  console.error('Fallo auditoria patientId/scope:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('OK: endpoints con patientId tienen contrato de scope conocido.');
