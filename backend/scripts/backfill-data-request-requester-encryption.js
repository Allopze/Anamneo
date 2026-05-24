#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill de cifrado de los datos del solicitante DSAR
 * (Ley 21.719 Art 14 quinquies — Phase F).
 *
 * Pre-requisitos:
 *   - ENCRYPTION_KEY configurada (hex 64 chars).
 *   - Migración `20260524030000_ley21719_phase_f_data_request_requester_encryption` aplicada.
 *   - Las columnas plaintext (requester_name, requester_rut, requester_email) deben existir.
 *
 * Flags: --dry-run, --force, --batch-size (default 200).
 */

const { PrismaClient } = require('@prisma/client');
const { createCipheriv, createHmac, randomBytes } = require('crypto');

const PREFIX = 'enc:v1:';
const ALG = 'aes-256-gcm';
const IV_LENGTH = 12;

function encryptField(plaintext) {
  const hex = process.env.ENCRYPTION_KEY;
  const key = Buffer.from(hex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + iv.toString('base64') + ':' + authTag.toString('base64') + ':' + encrypted.toString('base64');
}

function computeRutLookupHash(rut, pepper) {
  if (!rut) return null;
  const hex = process.env.ENCRYPTION_KEY;
  const normalized = rut.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (!normalized) return null;
  return createHmac('sha256', Buffer.from(hex, 'hex')).update(pepper + ':' + normalized).digest('hex');
}

function parseArgs() {
  const args = { dryRun: false, force: false, batchSize: 200 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--batch-size=')) args.batchSize = parseInt(arg.split('=')[1], 10);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const t0 = Date.now();
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) { console.error('[FAIL] ENCRYPTION_KEY requerida.'); process.exit(1); }

  const PEPPER = 'anamneo.v1.patient.rut_lookup'; // mismo pepper que Patient.rut para consistencia
  console.log(`[BACKFILL-DATA-REQUEST] iniciado dry-run=${args.dryRun} force=${args.force}`);

  const prisma = new PrismaClient();
  try {
    try {
      await prisma.$queryRawUnsafe('SELECT requester_name FROM patient_data_requests LIMIT 1');
    } catch {
      console.error('[FAIL] Columna requester_name ya no existe. Phase F-drop ya fue aplicada.');
      process.exit(1);
    }

    const [{ total }] = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS total FROM patient_data_requests',
    );
    console.log(`[BACKFILL-DATA-REQUEST] ${total} solicitudes`);

    let processed = 0, updated = 0, skipped = 0, errored = 0, lastId = '';

    while (true) {
      const batch = await prisma.$queryRawUnsafe(
        `SELECT id,
                requester_name AS "requesterName",
                requester_rut AS "requesterRut",
                requester_email AS "requesterEmail",
                requester_name_enc AS "requesterNameEnc"
         FROM patient_data_requests
         WHERE id > $1 ORDER BY id ASC LIMIT $2`,
        lastId, args.batchSize,
      );
      if (batch.length === 0) break;

      for (const r of batch) {
        processed++;
        if (r.requesterNameEnc && !args.force) { skipped++; continue; }
        try {
          const data = {
            requesterNameEnc: encryptField(r.requesterName),
            requesterRutEnc: r.requesterRut ? encryptField(r.requesterRut) : null,
            requesterRutLookupHash: computeRutLookupHash(r.requesterRut, PEPPER),
            requesterEmailEnc: encryptField(r.requesterEmail),
          };
          if (!args.dryRun) {
            await prisma.patientDataRequest.update({ where: { id: r.id }, data });
            await prisma.auditLog.create({
              data: {
                entityType: 'PatientDataRequest', entityId: r.id,
                userId: 'system:backfill', action: 'UPDATE', reason: 'DATA_REQUEST_UPDATED',
                diff: JSON.stringify({ scope: 'DATA_REQUEST_REQUESTER_ENC_BACKFILL' }), result: 'SUCCESS',
              },
            });
          }
          updated++;
        } catch (err) { errored++; console.error(`  [ERR] request ${r.id}: ${err.message}`); }
      }
      lastId = batch[batch.length - 1].id;
      if (batch.length < args.batchSize) break;
    }

    const ms = Date.now() - t0;
    console.log('---');
    console.log(`[BACKFILL-DATA-REQUEST] ${ms}ms | proc:${processed} upd:${updated}${args.dryRun ? '(dry)' : ''} skip:${skipped} err:${errored}`);
    if (errored > 0) process.exit(2);
  } finally { await prisma.$disconnect(); }
}

main().catch((err) => { console.error('[BACKFILL-DATA-REQUEST] fatal:', err); process.exit(1); });
