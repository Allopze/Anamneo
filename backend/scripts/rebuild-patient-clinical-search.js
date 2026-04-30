/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');
const { resolveDatabaseUrl } = require('./sqlite-utils');

const SEARCHABLE_SECTION_KEYS = [
  'MOTIVO_CONSULTA',
  'ANAMNESIS_PROXIMA',
  'REVISION_SISTEMAS',
];

function quotedSectionKeys() {
  return SEARCHABLE_SECTION_KEYS.map((key) => `'${key}'`).join(', ');
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

async function countProjectedRows(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS "count"
    FROM (
      SELECT "encounters"."patient_id", "encounters"."medico_id"
      FROM "encounter_sections"
      JOIN "encounters" ON "encounters"."id" = "encounter_sections"."encounter_id"
      WHERE "encounter_sections"."section_key" IN (${quotedSectionKeys()})
      GROUP BY "encounters"."patient_id", "encounters"."medico_id"
      HAVING length(trim(lower(group_concat("encounter_sections"."data", char(10))))) > 0
    ) AS "projected";
  `);
  const count = rows?.[0]?.count ?? 0;
  return typeof count === 'bigint' ? Number(count) : Number(count);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({
    datasources: {
      db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) },
    },
  });

  try {
    await prisma.$connect();
    const before = await prisma.patientClinicalSearch.count();
    const projected = await countProjectedRows(prisma);

    if (options.dryRun) {
      console.log(JSON.stringify({
        event: 'patient_clinical_search_rebuild_dry_run',
        before,
        projected,
        drift: projected - before,
        dryRun: true,
      }));
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('DELETE FROM "patient_clinical_search";');
      await tx.$executeRawUnsafe(`
        INSERT INTO "patient_clinical_search" ("id", "patient_id", "medico_id", "text", "updated_at")
        SELECT
          lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS "id",
          "encounters"."patient_id",
          "encounters"."medico_id",
          lower(group_concat("encounter_sections"."data", char(10))) AS "text",
          CURRENT_TIMESTAMP AS "updated_at"
        FROM "encounter_sections"
        JOIN "encounters" ON "encounters"."id" = "encounter_sections"."encounter_id"
        WHERE "encounter_sections"."section_key" IN (${quotedSectionKeys()})
        GROUP BY "encounters"."patient_id", "encounters"."medico_id"
        HAVING length(trim("text")) > 0;
      `);
    });

    const after = await prisma.patientClinicalSearch.count();
    console.log(JSON.stringify({
      event: 'patient_clinical_search_rebuilt',
      before,
      after,
      projected,
      dryRun: false,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
