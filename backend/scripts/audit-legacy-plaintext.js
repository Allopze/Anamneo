#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src');

function read(relativePath) {
  return fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

const checks = [
  {
    file: 'patient-consents/patient-consents.service.ts',
    required: [
      'signerNameEnc: encryptField(dto.signerName)',
      'signerRutLookupHash: computeRutLookupHash(dto.signerRut ?? null)',
    ],
    forbidden: [
      'ENCRYPTED_LEGACY_PLACEHOLDER',
      '?? c.signerName',
      'c.signerRut,',
    ],
  },
  {
    file: 'patient-data-rights/patient-data-rights.service.ts',
    required: [
      'requesterNameEnc: encryptField(dto.requesterName)',
      'requesterEmailEnc: encryptField(dto.requesterEmail)',
    ],
    forbidden: [
      'ENCRYPTED_LEGACY_PLACEHOLDER',
      '?? item.requesterName',
      '?? item.requesterEmail',
    ],
  },
  {
    // Logic moved to helpers during patient-portal refactor
    file: 'patient-portal/patient-portal-records.helpers.ts',
    required: [
      'requesterNameEnc: encryptField(patientIdentifiers.nombre)',
      'requesterEmailEnc: encryptField(user.email)',
    ],
    forbidden: [
      'requesterName: ENCRYPTED_LEGACY_PLACEHOLDER',
      'requesterRut: null',
      'requesterEmail: ENCRYPTED_LEGACY_PLACEHOLDER',
    ],
  },
  {
    file: 'patients/patients-demographics-mutations.ts',
    forbidden: [
      'updateData.legalRepresentativeName =',
      'updateData.legalRepresentativeRut =',
      'updateData.legalRepresentativeRelationship =',
      'updateData.legalRepresentativeContact =',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  for (const token of check.required || []) {
    if (!content.includes(token)) {
      failures.push(`${check.file} no contiene guardrail requerido: ${token}`);
    }
  }
  for (const token of check.forbidden || []) {
    if (content.includes(token)) {
      failures.push(`${check.file} contiene escritura plaintext legacy prohibida: ${token}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Fallo auditoria de columnas plaintext legacy:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('OK: nuevas escrituras sensibles usan campos cifrados/hash o placeholders legacy.');
