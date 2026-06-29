#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill de cifrado app-level de IP y UserAgent en tablas de sesión y tokens
 * (Ley 21.719 Art 14 quinquies lit a — cifrado de metadatos de red).
 *
 * Las tablas ya cifradas (EncounterSignature, PatientDataProcessingConsent,
 * UserLegalAcceptance) NO necesitan este script.
 *
 * Tablas soportadas:
 *   user_sessions
 *   password_reset_tokens
 *   patient_portal_sessions
 *   patient_portal_password_reset_tokens
 *
 * Pre-requisitos:
 *   - ENCRYPTION_KEY configurada (hex 64 chars).
 *   - Ninguna migración adicional: usa las columnas ip_address / user_agent
 *     existentes (cifrado inline con prefijo enc:v1:).
 *
 * Flags:
 *   --table=<nombre>   OBLIGATORIO. Nombre de la tabla a procesar.
 *   --dry-run          no escribe nada.
 *   --force            re-cifra aunque ya tengan enc:v1:.
 *   --batch-size=N     default 500.
 *
 * Uso:
 *   node backend/scripts/backfill-net-meta-encryption.js --table=user_sessions --dry-run
 *   node backend/scripts/backfill-net-meta-encryption.js --table=user_sessions
 *   node backend/scripts/backfill-net-meta-encryption.js --table=password_reset_tokens
 *   node backend/scripts/backfill-net-meta-encryption.js --table=patient_portal_sessions
 *   node backend/scripts/backfill-net-meta-encryption.js --table=patient_portal_password_reset_tokens
 */

const { PrismaClient } = require('@prisma/client');
const { createCipheriv, randomBytes } = require('crypto');

const SUPPORTED_TABLES = [
  'user_sessions',
  'password_reset_tokens',
  'patient_portal_sessions',
  'patient_portal_password_reset_tokens',
];

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

function parseArgs() {
  const args = { table: null, dryRun: false, force: false, batchSize: 500 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--batch-size=')) args.batchSize = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--table=')) args.table = arg.split('=')[1];
  }
  return args;
}

async function main() {
  const args = parseArgs();

  if (!args.table || !SUPPORTED_TABLES.includes(args.table)) {
    console.error('[FAIL] --table=<tabla> es obligatorio. Tablas soportadas:');
    SUPPORTED_TABLES.forEach((t) => console.error(`  ${t}`));
    process.exit(1);
  }

  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    console.error('[FAIL] ENCRYPTION_KEY requerida (hex 64 chars).');
    process.exit(1);
  }

  const table = args.table;
  const tag = `[BACKFILL-NET-META:${table}]`;
  console.log(`${tag} iniciado dry-run=${args.dryRun} force=${args.force} batch=${args.batchSize}`);

  const prisma = new PrismaClient();
  try {
    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total FROM ${table}
       WHERE ip_address IS NOT NULL OR user_agent IS NOT NULL`,
    );
    const [{ plaintext }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS plaintext FROM ${table}
       WHERE (ip_address IS NOT NULL AND ip_address NOT LIKE 'enc:v1:%')
          OR (user_agent IS NOT NULL AND user_agent NOT LIKE 'enc:v1:%')`,
    );
    console.log(`${tag} ${total} filas con IP/UA, ${plaintext} en texto plano`);

    if (plaintext === 0 && !args.force) {
      console.log(`${tag} nada que cifrar. Usa --force para re-cifrar.`);
      return;
    }

    let processed = 0, updated = 0, skipped = 0, errored = 0, lastId = '';

    while (true) {
      const whereExtra = args.force
        ? `AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)`
        : `AND ((ip_address IS NOT NULL AND ip_address NOT LIKE 'enc:v1:%')
             OR (user_agent IS NOT NULL AND user_agent NOT LIKE 'enc:v1:%'))`;

      const batch = await prisma.$queryRawUnsafe(
        `SELECT id, ip_address AS "ipAddress", user_agent AS "userAgent"
         FROM ${table}
         WHERE id > $1 ${whereExtra}
         ORDER BY id ASC LIMIT $2`,
        lastId, args.batchSize,
      );

      if (batch.length === 0) break;

      for (const row of batch) {
        processed++;
        const alreadyEncIp = row.ipAddress?.startsWith(PREFIX);
        const alreadyEncUa = row.userAgent?.startsWith(PREFIX);
        if (alreadyEncIp && alreadyEncUa && !args.force) { skipped++; continue; }

        try {
          const newIp = row.ipAddress && (!alreadyEncIp || args.force) ? encryptField(row.ipAddress) : row.ipAddress;
          const newUa = row.userAgent && (!alreadyEncUa || args.force) ? encryptField(row.userAgent) : row.userAgent;

          if (!args.dryRun) {
            await prisma.$executeRawUnsafe(
              `UPDATE ${table} SET ip_address = $1, user_agent = $2 WHERE id = $3`,
              newIp ?? null, newUa ?? null, row.id,
            );
          }
          updated++;
        } catch (err) {
          errored++;
          console.error(`  [ERR] id=${row.id}: ${err.message}`);
        }
      }

      lastId = batch[batch.length - 1].id;
      if (batch.length < args.batchSize) break;
    }

    const ratio = processed > 0 ? Math.round((updated / processed) * 100) : 0;
    console.log('---');
    console.log(`${tag} proc:${processed} upd:${updated}${args.dryRun ? '(dry)' : ''} skip:${skipped} err:${errored} (${ratio}%)`);
    if (errored > 0) process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error('[BACKFILL-NET-META] fatal:', err); process.exit(1); });
