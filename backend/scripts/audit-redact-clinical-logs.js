/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');
const { resolveDatabaseUrl } = require('./sqlite-utils');

const CLINICAL_ENTITY_TYPES = [
  'Patient',
  'PatientHistory',
  'Encounter',
  'EncounterSection',
  'PatientProblem',
  'EncounterTask',
];

const SAFE_KEYS = [
  'status',
  'reviewStatus',
  'sectionKey',
  'scope',
  'completed',
  'schemaVersion',
  'patientId',
  'encounterId',
  'format',
];

function parseDiff(rawDiff) {
  if (!rawDiff) {
    return null;
  }

  if (typeof rawDiff !== 'string') {
    return rawDiff;
  }

  try {
    return JSON.parse(rawDiff);
  } catch {
    return null;
  }
}

function summarizeLegacyClinicalDiff(entityType, rawDiff) {
  const parsedDiff = parseDiff(rawDiff);
  const summary = {
    redacted: true,
    entityType,
  };

  if (parsedDiff && typeof parsedDiff === 'object' && !Array.isArray(parsedDiff)) {
    summary.fieldCount = Object.keys(parsedDiff).length;

    for (const key of SAFE_KEYS) {
      const value = parsedDiff[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        summary[key] = value;
      }
    }
  }

  return JSON.stringify(summary);
}

async function main() {
  const resolvedDatabaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
  const prisma = resolvedDatabaseUrl
    ? new PrismaClient({
      datasources: {
        db: { url: resolvedDatabaseUrl },
      },
    })
    : new PrismaClient();

  let cursor = null;
  let updated = 0;

  try {
    await prisma.$connect();

    while (true) {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: { in: CLINICAL_ENTITY_TYPES },
          diff: { not: null },
        },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (logs.length === 0) {
        break;
      }

      for (const log of logs) {
        const redactedDiff = summarizeLegacyClinicalDiff(log.entityType, log.diff);
        if (redactedDiff !== log.diff) {
          await prisma.auditLog.update({
            where: { id: log.id },
            data: { diff: redactedDiff },
          });
          updated += 1;
        }

        cursor = log.id;
      }
    }

    console.log(JSON.stringify({
      event: 'audit_clinical_logs_redacted',
      updated,
      entityTypes: CLINICAL_ENTITY_TYPES,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'audit_clinical_logs_redaction_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
