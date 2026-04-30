/* eslint-disable no-console */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { resolveDatabaseUrl } = require('./sqlite-utils');

function parseLimit(argv) {
  if (argv.includes('--full')) return undefined;
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  if (!limitArg) return 1000;
  const parsedLimit = Number.parseInt(limitArg.slice('--limit='.length), 10);
  return Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 1000;
}

function computeIntegrityHash(previousHash, payload) {
  return crypto
    .createHash('sha256')
    .update(previousHash + JSON.stringify(payload))
    .digest('hex');
}

async function saveSnapshot(prisma, result, limit) {
  const verifiedAt = new Date();
  const verificationScope = limit ? `LIMIT_${limit}` : 'FULL';
  const payload = {
    valid: result.valid,
    checked: result.checked,
    total: result.total,
    brokenAt: result.brokenAt || null,
    warning: result.warning || null,
    verificationScope,
    verifiedAt,
  };

  await prisma.auditIntegritySnapshot.upsert({
    where: { id: 'latest' },
    create: {
      id: 'latest',
      ...payload,
    },
    update: payload,
  });

  return {
    ...result,
    verifiedAt: verifiedAt.toISOString(),
    verificationScope,
  };
}

async function verifyChain(prisma, limit) {
  const total = await prisma.auditLog.count();
  const rawEntries = await prisma.auditLog.findMany({
    orderBy: { timestamp: limit ? 'desc' : 'asc' },
    take: limit ? limit + 1 : undefined,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      userId: true,
      requestId: true,
      action: true,
      reason: true,
      result: true,
      diff: true,
      integrityHash: true,
      previousHash: true,
    },
  });
  const boundaryEntry = limit && rawEntries.length > limit ? rawEntries[limit] : undefined;
  const entries = limit ? rawEntries.slice(0, limit).reverse() : rawEntries;

  let expectedPreviousHash = boundaryEntry?.integrityHash || 'GENESIS';
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry.integrityHash) continue;
    if (entry.previousHash !== expectedPreviousHash) {
      return saveSnapshot(prisma, {
        valid: false,
        checked: index,
        total,
        brokenAt: entry.id,
      }, limit);
    }

    const expectedHash = computeIntegrityHash(expectedPreviousHash, {
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId: entry.userId,
      requestId: entry.requestId,
      action: entry.action,
      reason: entry.reason,
      result: entry.result,
      diff: entry.diff,
    });

    if (entry.integrityHash !== expectedHash) {
      return saveSnapshot(prisma, {
        valid: false,
        checked: index,
        total,
        brokenAt: entry.id,
      }, limit);
    }

    expectedPreviousHash = entry.integrityHash;
  }

  return saveSnapshot(prisma, {
    valid: true,
    checked: entries.length,
    total,
    warning: limit && total > entries.length
      ? `Solo se verificaron las ${entries.length} entradas mas recientes de ${total}. Use --full para una verificacion completa.`
      : undefined,
  }, limit);
}

async function main() {
  const limit = parseLimit(process.argv.slice(2));
  const prisma = new PrismaClient({
    datasources: {
      db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) },
    },
  });

  try {
    await prisma.$connect();
    const result = await verifyChain(prisma, limit);
    console.log(JSON.stringify({
      event: 'audit_integrity_verified',
      ...result,
    }));
    if (!result.valid) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
