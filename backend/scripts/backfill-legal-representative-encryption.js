#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill de cifrado app-level del representante legal NNA
 * (Ley 21.719 Art 16 quater — Phase D).
 *
 * Recorre todos los `Patient` que tienen columnas plaintext de representante
 * legal pobladas y, si no tienen `*_enc`, los cifra y persiste.
 *
 * Pre-requisitos:
 *   - ENCRYPTION_KEY configurada (hex 64 chars).
 *   - Migración `20260524010000_ley21719_phase_d_legal_representative_encryption`
 *     aplicada (columnas *_enc deben existir).
 *   - Las columnas plaintext (legal_representative_name, etc.) deben existir
 *     todavía (antes de aplicar la migración Phase D-drop).
 *
 * Flags:
 *   --dry-run     no escribe nada.
 *   --force       re-encripta aunque ya tengan `*_enc`.
 *   --batch-size  default 200.
 *
 * Uso:
 *   node backend/scripts/backfill-legal-representative-encryption.js --dry-run
 *   node backend/scripts/backfill-legal-representative-encryption.js
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
  const normalized = rut
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  if (!normalized) return null;
  return createHmac('sha256', Buffer.from(hex, 'hex'))
    .update(pepper + ':' + normalized)
    .digest('hex');
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
  if (!hex || hex.length !== 64) {
    console.error('[FAIL] ENCRYPTION_KEY no configurada (debe ser hex 64 chars). Abortando.');
    process.exit(1);
  }

  const PEPPER = 'anamneo.v1.patient.legal_rep.rut_lookup';
  console.log(`[BACKFILL-LEGAL-REP] iniciado dry-run=${args.dryRun} force=${args.force} batch=${args.batchSize}`);

  const prisma = new PrismaClient();
  try {
    // Verificar que las columnas plaintext todavía existen
    try {
      await prisma.$queryRawUnsafe('SELECT legal_representative_name FROM patients LIMIT 1');
    } catch {
      console.log('[SKIP] La columna "legal_representative_name" ya no existe.');
      console.log('       La migración Phase D-drop ya fue aplicada. Este script ya no es necesario.');
      return;
    }

    const [countResult] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total FROM patients
       WHERE legal_representative_name IS NOT NULL
          OR legal_representative_rut IS NOT NULL`,
    );
    const total = countResult.total;
    console.log(`[BACKFILL-LEGAL-REP] ${total} pacientes con representante legal`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errored = 0;

    let lastId = '';
    while (true) {
      const batch = await prisma.$queryRawUnsafe(
        `SELECT id,
                legal_representative_name          AS "legalRepresentativeName",
                legal_representative_rut           AS "legalRepresentativeRut",
                legal_representative_relationship  AS "legalRepresentativeRelationship",
                legal_representative_contact       AS "legalRepresentativeContact",
                legal_representative_name_enc      AS "legalRepresentativeNameEnc"
         FROM patients
         WHERE id > $1
           AND (legal_representative_name IS NOT NULL OR legal_representative_rut IS NOT NULL)
         ORDER BY id ASC
         LIMIT $2`,
        lastId,
        args.batchSize,
      );

      if (batch.length === 0) break;

      for (const p of batch) {
        processed += 1;
        if (p.legalRepresentativeNameEnc && !args.force) {
          skipped += 1;
          continue;
        }
        try {
          const data = {
            legalRepresentativeNameEnc: p.legalRepresentativeName
              ? encryptField(p.legalRepresentativeName) : null,
            legalRepresentativeRutEnc: p.legalRepresentativeRut
              ? encryptField(p.legalRepresentativeRut) : null,
            legalRepresentativeRutLookupHash: computeRutLookupHash(p.legalRepresentativeRut, PEPPER),
            legalRepresentativeRelationshipEnc: p.legalRepresentativeRelationship
              ? encryptField(p.legalRepresentativeRelationship) : null,
            legalRepresentativeContactEnc: p.legalRepresentativeContact
              ? encryptField(p.legalRepresentativeContact) : null,
          };
          if (!args.dryRun) {
            await prisma.patient.update({ where: { id: p.id }, data });
            await prisma.auditLog.create({
              data: {
                entityType: 'Patient',
                entityId: p.id,
                userId: 'system:backfill',
                action: 'UPDATE',
                reason: 'PATIENT_UPDATED',
                diff: JSON.stringify({ scope: 'LEGAL_REP_ENC_BACKFILL' }),
                result: 'SUCCESS',
              },
            });
          }
          updated += 1;
        } catch (err) {
          errored += 1;
          console.error(`  [ERR] patient ${p.id}: ${err.message}`);
        }
      }
      lastId = batch[batch.length - 1].id;
      if (batch.length < args.batchSize) break;
    }

    const totalMs = Date.now() - t0;
    console.log('---');
    console.log(`[BACKFILL-LEGAL-REP] completado en ${totalMs}ms`);
    console.log(`  procesados:  ${processed}`);
    console.log(`  actualizados:${updated}${args.dryRun ? ' (dry-run, sin escribir)' : ''}`);
    console.log(`  saltados:    ${skipped}`);
    console.log(`  errores:     ${errored}`);
    if (errored > 0) process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[BACKFILL-LEGAL-REP] error fatal:', err);
  process.exit(1);
});
