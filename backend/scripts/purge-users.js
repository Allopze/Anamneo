/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');
const { resolveDatabaseUrl } = require('./pg-utils');

async function main() {
  const url = resolveDatabaseUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  console.log(`Using PostgreSQL DB: ${new URL(url).pathname.replace(/^\//, '')}`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deletedPatients = await tx.patient.deleteMany({});
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
