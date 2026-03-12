/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function resolveSqliteUrl() {
  const backendDir = path.join(__dirname, '..');

  const candidates = [
    path.join(backendDir, 'prisma', 'dev.db'),
    path.join(backendDir, 'dev.db'),
  ];

  const existing = candidates.find((p) => fs.existsSync(p));
  const dbPath = existing || candidates[0];

  // Prisma expects forward slashes in file: URLs on Windows.
  const normalized = dbPath.replace(/\\/g, '/');
  return `file:${normalized}`;
}

async function main() {
  const url = resolveSqliteUrl();
  const prisma = new PrismaClient({
    datasources: {
      db: { url },
    },
  });

  console.log(`Using SQLite DB: ${url}`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Encounters, sections, attachments, histories, suggestion logs are deleted via cascade from Patient/Encounter.
      const deletedPatients = await tx.patient.deleteMany({});

      // Break assistant -> medico FK before deleting users.
      await tx.user.updateMany({ data: { medicoId: null } });

      const deletedUsers = await tx.user.deleteMany({});

      return { deletedPatients: deletedPatients.count, deletedUsers: deletedUsers.count };
    });

    console.log(`Deleted patients: ${result.deletedPatients}`);
    console.log(`Deleted users: ${result.deletedUsers}`);
    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
