#!/usr/bin/env node

/* eslint-disable no-console */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { resolveDatabaseUrl } = require('./pg-utils');

const CONFIRMATION = 'REGISTRAR EVENTO EMERGENCIA';
const ALLOWED_ACTIONS = new Set(['CREATE', 'UPDATE', 'DELETE', 'READ', 'EXPORT', 'DOWNLOAD']);

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    parsed[key] = rest.join('=');
  }
  return {
    userId: parsed['user-id'],
    entityType: parsed['entity-type'] || 'OperationalEmergency',
    entityId: parsed['entity-id'] || `manual-${new Date().toISOString()}`,
    action: parsed.action || 'UPDATE',
    message: parsed.message,
    reason: parsed.reason,
    confirmation: parsed.confirmation,
  };
}

function assertArgs(args) {
  const missing = [];
  if (!args.userId) missing.push('--user-id');
  if (!args.reason) missing.push('--reason');
  if (!args.message) missing.push('--message');
  if (args.confirmation !== CONFIRMATION) missing.push(`--confirmation="${CONFIRMATION}"`);
  if (!ALLOWED_ACTIONS.has(args.action)) missing.push('--action=CREATE|UPDATE|DELETE|READ|EXPORT|DOWNLOAD');

  if (missing.length > 0) {
    throw new Error(`Uso invalido. Faltan o son invalidos: ${missing.join(', ')}`);
  }
}

function computeIntegrityHash(previousHash, payload) {
  return crypto
    .createHash('sha256')
    .update(previousHash + JSON.stringify(payload))
    .digest('hex');
}

async function acquireAuditChainHead(tx) {
  await tx.$executeRawUnsafe(
    'INSERT INTO audit_chain_state (id, latest_hash, sequence, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING',
    'default',
    'GENESIS',
    0,
  );

  let state = (await tx.$queryRawUnsafe(
    'SELECT latest_hash AS "latestHash", sequence FROM audit_chain_state WHERE id = $1 LIMIT 1 FOR UPDATE',
    'default',
  ))[0];

  if (state.sequence === 0) {
    const [{ total } = { total: 0 }] = await tx.$queryRawUnsafe('SELECT COUNT(*) AS total FROM audit_logs');
    const [lastEntry] = await tx.$queryRawUnsafe(
      'SELECT integrity_hash AS "integrityHash" FROM audit_logs WHERE integrity_hash IS NOT NULL ORDER BY timestamp DESC LIMIT 1',
    );
    const existingEntries = Number(total);
    if (existingEntries > 0 || lastEntry?.integrityHash) {
      state = {
        latestHash: lastEntry?.integrityHash || 'GENESIS',
        sequence: existingEntries,
      };
      await tx.$executeRawUnsafe(
        'UPDATE audit_chain_state SET latest_hash = $1, sequence = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        state.latestHash,
        state.sequence,
        'default',
      );
    }
  }

  return {
    previousHash: state.latestHash,
    nextSequence: state.sequence + 1,
  };
}

async function appendAuditLog(prisma, args) {
  return prisma.$transaction(async (tx) => {
    const chainHead = await acquireAuditChainHead(tx);
    const payload = {
      entityType: args.entityType,
      entityId: args.entityId,
      userId: args.userId,
      requestId: null,
      action: args.action,
      reason: 'AUDIT_EMERGENCY_EVENT',
      result: 'SUCCESS',
      diff: JSON.stringify({
        emergencyReason: args.reason,
        message: args.message,
        recordedVia: 'backend/scripts/audit-emergency-event.js',
      }),
    };
    const integrityHash = computeIntegrityHash(chainHead.previousHash, payload);
    const entryId = crypto.randomUUID();

    await tx.$executeRawUnsafe(
      'INSERT INTO audit_logs (id, entity_type, entity_id, user_id, request_id, action, reason, result, diff, integrity_hash, previous_hash, chain_sequence, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      entryId,
      payload.entityType,
      payload.entityId,
      payload.userId,
      payload.requestId,
      payload.action,
      payload.reason,
      payload.result,
      payload.diff,
      integrityHash,
      chainHead.previousHash,
      chainHead.nextSequence,
      new Date(),
    );

    await tx.$executeRawUnsafe(
      'INSERT INTO audit_chain_state (id, latest_hash, sequence, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET latest_hash = excluded.latest_hash, sequence = excluded.sequence, updated_at = CURRENT_TIMESTAMP',
      'default',
      integrityHash,
      chainHead.nextSequence,
    );

    return { entryId, integrityHash, chainSequence: chainHead.nextSequence };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertArgs(args);

  const prisma = new PrismaClient({
    datasources: {
      db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) },
    },
  });

  try {
    await prisma.$connect();
    const result = await appendAuditLog(prisma, args);
    console.log(JSON.stringify({
      event: 'audit_emergency_event_recorded',
      ...result,
      entityType: args.entityType,
      entityId: args.entityId,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: 'audit_emergency_event_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
