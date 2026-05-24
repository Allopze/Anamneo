#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill de cifrado app-level de identificatorios del paciente
 * (Ley 21.719 Art 14 quinquies lit a — Phase C prerequisite).
 *
 * Lee las columnas plaintext directamente desde la DB con $queryRawUnsafe
 * porque el Prisma client ya fue regenerado sin esas columnas (schema.prisma
 * ya las eliminó del modelo Patient). La DB todavía las tiene hasta que se
 * aplique la migración 20260524000000_ley21719_phase_c_drop_patient_plaintext.
 *
 * Recorre todos los Patient y, cuando no tienen `*_enc` / `rut_lookup_hash`
 * poblados, los calcula a partir de los valores plaintext y los persiste.
 *
 * Pre-requisitos:
 *   - ENCRYPTION_KEY configurada (hex 64 chars). Sin clave, el script aborta.
 *   - La migración Phase C NO debe haberse aplicado todavía (las columnas
 *     plaintext deben existir en la DB).
 *
 * Flags:
 *   --dry-run     no escribe nada, solo reporta cuántos pacientes se
 *                 actualizarían.
 *   --force       re-encripta aunque ya tengan `*_enc`. Útil tras rotación
 *                 de clave.
 *   --batch-size  default 200.
 *
 * Uso:
 *   node backend/scripts/backfill-patient-identifier-encryption.js --dry-run
 *   node backend/scripts/backfill-patient-identifier-encryption.js
 *
 * Auditoría: cada paciente actualizado emite un AuditLog
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
    console.error('[FAIL] ENCRYPTION_KEY no configurada (debe ser hex 64 chars). Abortando.');
    process.exit(1);
  }

  console.log(`[BACKFILL] iniciado dry-run=${args.dryRun} force=${args.force} batch=${args.batchSize}`);
  console.log('[BACKFILL] Leyendo columnas plaintext vía $queryRawUnsafe (Prisma client ya no las expone)');

  const prisma = new PrismaClient();
  try {
    // Verificar que las columnas plaintext todavía existen (la migración Phase C no se aplicó)
    try {
      await prisma.$queryRawUnsafe('SELECT rut FROM patients LIMIT 1');
    } catch {
      console.error('[FAIL] La columna "rut" ya no existe en la tabla patients.');
      console.error('       La migración Phase C ya fue aplicada. Este script ya no es necesario.');
      process.exit(1);
    }

    const [countResult] = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS total FROM patients');
    const total = countResult.total;
    console.log(`[BACKFILL] ${total} pacientes en total`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errored = 0;

    let lastId = '';
    while (true) {
      // Paginación por cursor con id > lastId (evita OFFSET costoso)
      const batch = await prisma.$queryRawUnsafe(
        `SELECT id,
                rut, nombre, telefono, email, domicilio,
                contacto_emergencia_nombre AS "contactoEmergenciaNombre",
                contacto_emergencia_telefono AS "contactoEmergenciaTelefono",
                rut_enc AS "rutEnc",
                rut_lookup_hash AS "rutLookupHash",
                nombre_enc AS "nombreEnc",
                telefono_enc AS "telefonoEnc",
                email_enc AS "emailEnc",
                domicilio_enc AS "domicilioEnc",
                contacto_emergencia_nombre_enc AS "contactoEmergenciaNombreEnc",
                contacto_emergencia_telefono_enc AS "contactoEmergenciaTelefonoEnc"
         FROM patients
         WHERE id > $1
         ORDER BY id ASC
         LIMIT $2`,
        lastId,
        args.batchSize,
      );

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
      lastId = batch[batch.length - 1].id;
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
