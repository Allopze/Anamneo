#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill de cifrado app-level de identificatorios del paciente
 * (Ley 21.719 Art 14 quinquies lit a — Phase B).
 *
 * Recorre todos los `Patient` y, cuando no tienen `*_enc` o `rut_lookup_hash`
 * poblados, los calcula a partir de los valores plaintext y los persiste.
 *
 * Pre-requisitos:
 *   - ENCRYPTION_KEY configurada (hex 64 chars). Sin clave, el script
 *     aborta porque seria un no-op silencioso peligroso.
 *   - Migracion `20260523070000_ley21719_patient_identifier_encryption`
 *     aplicada (las columnas deben existir).
 *
 * Flags:
 *   --dry-run     no escribe nada, solo reporta cuantos paciente se
 *                 actualizarian.
 *   --force       reencripta aunque ya tengan `*_enc`. Util tras rotacion
 *                 de clave.
 *   --batch-size  default 200. Numero de pacientes por chunk.
 *
 * Uso:
 *   node backend/scripts/backfill-patient-identifier-encryption.js --dry-run
 *   node backend/scripts/backfill-patient-identifier-encryption.js
 *
 * Auditoria: cada paciente actualizado emite un evento AuditLog
 * `PATIENT_UPDATED` con `scope: 'IDENTIFIER_ENC_BACKFILL'` en el diff.
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

function computeRutLookupHash(rut) {
  if (!rut) return null;
  const hex = process.env.ENCRYPTION_KEY;
  const normalized = rut
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  if (!normalized) return null;
  const PEPPER = 'anamneo.v1.patient.rut_lookup';
  return createHmac('sha256', Buffer.from(hex, 'hex'))
    .update(PEPPER + ':' + normalized)
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
    console.error('[FAIL] ENCRYPTION_KEY no configurada (debe ser hex 64 chars). Abortando para evitar no-op silencioso.');
    process.exit(1);
  }

  console.log(`[BACKFILL] iniciado dry-run=${args.dryRun} force=${args.force} batch=${args.batchSize}`);

  const prisma = new PrismaClient();
  try {
    const total = await prisma.patient.count();
    console.log(`[BACKFILL] ${total} pacientes en total`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errored = 0;

    let cursor = undefined;
    while (true) {
      const batch = await prisma.patient.findMany({
        take: args.batchSize,
        skip: cursor ? 1 : 0,
        ...(cursor ? { cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          rut: true,
          nombre: true,
          telefono: true,
          email: true,
          domicilio: true,
          contactoEmergenciaNombre: true,
          contactoEmergenciaTelefono: true,
          rutEnc: true,
          rutLookupHash: true,
          nombreEnc: true,
          telefonoEnc: true,
          emailEnc: true,
          domicilioEnc: true,
          contactoEmergenciaNombreEnc: true,
          contactoEmergenciaTelefonoEnc: true,
        },
      });
      if (batch.length === 0) break;

      for (const p of batch) {
        processed += 1;
        const alreadyEnc = p.nombreEnc && (p.rut == null || p.rutLookupHash);
        if (alreadyEnc && !args.force) {
          skipped += 1;
          continue;
        }
        try {
          const data = {
            rutEnc: p.rut ? encryptField(p.rut) : null,
            rutLookupHash: p.rut ? computeRutLookupHash(p.rut) : null,
            nombreEnc: p.nombre ? encryptField(p.nombre) : null,
            telefonoEnc: p.telefono ? encryptField(p.telefono) : null,
            emailEnc: p.email ? encryptField(p.email) : null,
            domicilioEnc: p.domicilio ? encryptField(p.domicilio) : null,
            contactoEmergenciaNombreEnc: p.contactoEmergenciaNombre
              ? encryptField(p.contactoEmergenciaNombre)
              : null,
            contactoEmergenciaTelefonoEnc: p.contactoEmergenciaTelefono
              ? encryptField(p.contactoEmergenciaTelefono)
              : null,
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
                diff: JSON.stringify({
                  scope: 'IDENTIFIER_ENC_BACKFILL',
                  fieldsEncrypted: ['rut', 'nombre', 'telefono', 'email', 'domicilio', 'contactoEmergenciaNombre', 'contactoEmergenciaTelefono'].filter(
                    (k) => p[k] != null,
                  ),
                }),
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
      cursor = batch[batch.length - 1].id;
      if (batch.length < args.batchSize) break;
    }

    const totalMs = Date.now() - t0;
    console.log('---');
    console.log(`[BACKFILL] completado en ${totalMs}ms`);
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
  console.error('[BACKFILL] error fatal:', err);
  process.exit(1);
});
