#!/usr/bin/env node

/**
 * Purge soft-deleted attachments whose retention period has expired.
 *
 * Usage:
 *   node scripts/purge-deleted-attachments.js
 *
 * Environment:
 *   DATABASE_URL                          — Prisma connection string
 *   UPLOAD_DEST                           — Uploads root directory
 *   ATTACHMENT_SOFT_DELETE_RETENTION_DAYS  — Days to keep soft-deleted files (default: 30)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const RETENTION_DAYS = parseInt(process.env.ATTACHMENT_SOFT_DELETE_RETENTION_DAYS || '30', 10);
const UPLOAD_DEST = process.env.UPLOAD_DEST || path.join(__dirname, '..', 'uploads');

const prisma = new PrismaClient();

function resolveUploadsRoot(dest) {
  const root = path.resolve(dest);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

function resolveStoragePath(uploadsRoot, storagePath) {
  const absolutePath = path.isAbsolute(storagePath)
    ? path.normalize(storagePath)
    : path.resolve(uploadsRoot, storagePath);
  const relativeToRoot = path.relative(uploadsRoot, absolutePath);
  if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return absolutePath;
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const uploadsRoot = resolveUploadsRoot(UPLOAD_DEST);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  console.log(`[purge] Retention: ${RETENTION_DAYS} days, cutoff: ${cutoff.toISOString()}`);
  console.log(`[purge] Uploads root: ${uploadsRoot}`);

  const expired = await prisma.attachment.findMany({
    where: {
      deletedAt: { not: null, lte: cutoff },
    },
    select: { id: true, storagePath: true, originalName: true },
  });

  console.log(`[purge] Found ${expired.length} expired soft-deleted attachment(s)`);

  let purged = 0;
  let errors = 0;

  for (const att of expired) {
    const resolved = resolveStoragePath(uploadsRoot, att.storagePath);
    if (resolved) {
      safeUnlink(resolved);
    }
    try {
      await prisma.attachment.delete({ where: { id: att.id } });
      purged++;
    } catch (err) {
      console.error(`[purge] Error deleting ${att.id} (${att.originalName}): ${err.message}`);
      errors++;
    }
  }

  console.log(`[purge] Done: ${purged} purged, ${errors} errors`);
}

main()
  .catch((err) => {
    console.error('[purge] Fatal:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
