#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill de cifrado de la identidad del firmante del consentimiento
 * (Ley 21.719 Art 14 quinquies — Phase E).
 *
 * Pre-requisitos:
 *   - ENCRYPTION_KEY configurada (hex 64 chars).
 *   - Migración `20260524020000_ley21719_phase_e_consent_signer_encryption` aplicada.
 *   - Las columnas plaintext (signer_name, signer_rut) deben existir todavía.
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

  const PEPPER = 'anamneo.v1.consent.signer.rut_lookup';
  console.log(`[BACKFILL-CONSENT-SIGNER] iniciado dry-run=${args.dryRun} force=${args.force}`);

  const prisma = new PrismaClient();
  try {
    try {
      await prisma.$queryRawUnsafe('SELECT signer_name FROM patient_data_processing_consents LIMIT 1');
    } catch {
      console.error('[FAIL] Columna signer_name ya no existe. Phase E-drop ya fue aplicada.');
      process.exit(1);
    }

    const [{ total }] = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS total FROM patient_data_processing_consents',
    );
    console.log(`[BACKFILL-CONSENT-SIGNER] ${total} consentimientos`);

    let processed = 0, updated = 0, skipped = 0, errored = 0, lastId = '';

    while (true) {
      const batch = await prisma.$queryRawUnsafe(
        `SELECT id, signer_name AS "signerName", signer_rut AS "signerRut",
                signer_name_enc AS "signerNameEnc"
         FROM patient_data_processing_consents
         WHERE id > $1 ORDER BY id ASC LIMIT $2`,
        lastId, args.batchSize,
      );
      if (batch.length === 0) break;

      for (const c of batch) {
        processed++;
        if (c.signerNameEnc && !args.force) { skipped++; continue; }
        try {
          const data = {
            signerNameEnc: encryptField(c.signerName),
            signerRutEnc: c.signerRut ? encryptField(c.signerRut) : null,
            signerRutLookupHash: computeRutLookupHash(c.signerRut, PEPPER),
          };
          if (!args.dryRun) {
            await prisma.patientDataProcessingConsent.update({ where: { id: c.id }, data });
            await prisma.auditLog.create({
              data: {
                entityType: 'PatientDataProcessingConsent', entityId: c.id,
                userId: 'system:backfill', action: 'UPDATE', reason: 'CONSENT_UPDATED',
                diff: JSON.stringify({ scope: 'CONSENT_SIGNER_ENC_BACKFILL' }), result: 'SUCCESS',
              },
            });
          }
          updated++;
        } catch (err) { errored++; console.error(`  [ERR] consent ${c.id}: ${err.message}`); }
      }
      lastId = batch[batch.length - 1].id;
      if (batch.length < args.batchSize) break;
    }

    const ms = Date.now() - t0;
    console.log('---');
    console.log(`[BACKFILL-CONSENT-SIGNER] ${ms}ms | proc:${processed} upd:${updated}${args.dryRun ? '(dry)' : ''} skip:${skipped} err:${errored}`);
    if (errored > 0) process.exit(2);
  } finally { await prisma.$disconnect(); }
}

main().catch((err) => { console.error('[BACKFILL-CONSENT-SIGNER] fatal:', err); process.exit(1); });
