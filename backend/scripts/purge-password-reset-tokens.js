#!/usr/bin/env node

/**
 * Purge password reset tokens that are expired or used beyond the retention.
 *
 * Usage:
 *   node scripts/purge-password-reset-tokens.js
 *
 * Environment:
 *   DATABASE_URL                       — Prisma connection string
 *   PASSWORD_RESET_TOKEN_RETENTION_DAYS — Days to keep used/expired tokens (default: 7)
 */

const { PrismaClient } = require('@prisma/client');

const RETENTION_DAYS = parseInt(process.env.PASSWORD_RESET_TOKEN_RETENTION_DAYS || '7', 10);
const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { usedAt: { not: null, lt: cutoff } },
        { expiresAt: { lt: cutoff } },
      ],
    },
  });
  console.log(JSON.stringify({
    level: 'info',
    event: 'password_reset_tokens_purged',
    deleted: result.count,
    cutoff: cutoff.toISOString(),
  }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'password_reset_tokens_purge_failed',
      message: error instanceof Error ? error.message : 'unknown_error',
    }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
