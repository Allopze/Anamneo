import { AuditAction, AuditResult } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditIntegrityResult,
  AuditLogRow,
  computeIntegrityHash,
  supportsRawQueries,
} from './audit-integrity';

export async function verifyAuditChain(
  prisma: PrismaService,
  limit?: number,
): Promise<AuditIntegrityResult> {
  const total = await prisma.auditLog.count();
  const normalizedLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0
    ? Math.trunc(limit)
    : undefined;
  if (supportsRawQueries(prisma)) {
    const rawEntries = await prisma.$queryRawUnsafe<AuditLogRow[]>(
      normalizedLimit
        ? 'SELECT id, entity_type AS "entityType", entity_id AS "entityId", user_id AS "userId", request_id AS "requestId", action, reason, result, diff, integrity_hash AS "integrityHash", previous_hash AS "previousHash", chain_sequence AS "chainSequence", timestamp FROM audit_logs ORDER BY chain_sequence DESC, timestamp DESC LIMIT $1'
        : 'SELECT id, entity_type AS "entityType", entity_id AS "entityId", user_id AS "userId", request_id AS "requestId", action, reason, result, diff, integrity_hash AS "integrityHash", previous_hash AS "previousHash", chain_sequence AS "chainSequence", timestamp FROM audit_logs ORDER BY chain_sequence ASC, timestamp ASC',
      ...(normalizedLimit ? [normalizedLimit + 1] : []),
    );

    const boundaryEntry = normalizedLimit && rawEntries.length > normalizedLimit
      ? rawEntries[normalizedLimit]
      : undefined;
    const entries = normalizedLimit
      ? rawEntries.slice(0, normalizedLimit).reverse()
      : rawEntries;

    let expectedPreviousHash = boundaryEntry?.integrityHash ?? 'GENESIS';
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry.integrityHash) continue;
      if (entry.previousHash !== expectedPreviousHash) {
        return saveIntegritySnapshot(
          prisma,
          { valid: false, checked: index, total, brokenAt: entry.id },
          normalizedLimit,
        );
      }
      const expectedHash = computeIntegrityHash(expectedPreviousHash, {
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
        requestId: entry.requestId,
        action: entry.action as AuditAction,
        reason: entry.reason,
        result: entry.result as AuditResult,
        diff: entry.diff,
      });
      if (entry.integrityHash !== expectedHash) {
        return saveIntegritySnapshot(
          prisma,
          { valid: false, checked: index, total, brokenAt: entry.id },
          normalizedLimit,
        );
      }
      expectedPreviousHash = entry.integrityHash;
    }

    const warning = normalizedLimit && total > entries.length
      ? `Solo se verificaron las ${entries.length} entradas mas recientes de ${total}. Use full=true para una verificacion completa.`
      : undefined;

    return saveIntegritySnapshot(
      prisma,
      { valid: true, checked: entries.length, total, warning },
      normalizedLimit,
    );
  }

  const select = {
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
    chainSequence: true,
  } as any;
  const rawEntries = await prisma.auditLog.findMany({
    orderBy: normalizedLimit
      ? ([{ chainSequence: 'desc' }, { timestamp: 'desc' }] as any)
      : ([{ chainSequence: 'asc' }, { timestamp: 'asc' }] as any),
    take: normalizedLimit ? normalizedLimit + 1 : undefined,
    select,
  });
  const boundaryEntry = normalizedLimit && rawEntries.length > normalizedLimit
    ? rawEntries[normalizedLimit]
    : undefined;
  const entries = normalizedLimit
    ? rawEntries.slice(0, normalizedLimit).reverse()
    : rawEntries;

  let expectedPreviousHash = boundaryEntry?.integrityHash ?? 'GENESIS';
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry.integrityHash) continue;
    if (entry.previousHash !== expectedPreviousHash) {
      return saveIntegritySnapshot(
        prisma,
        { valid: false, checked: index, total, brokenAt: entry.id },
        normalizedLimit,
      );
    }
    const expectedHash = computeIntegrityHash(expectedPreviousHash, {
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId: entry.userId,
      requestId: entry.requestId,
      action: entry.action as AuditAction,
      reason: entry.reason,
      result: entry.result as AuditResult,
      diff: entry.diff,
    });
    if (entry.integrityHash !== expectedHash) {
      return saveIntegritySnapshot(
        prisma,
        { valid: false, checked: index, total, brokenAt: entry.id },
        normalizedLimit,
      );
    }
    expectedPreviousHash = entry.integrityHash;
  }

  const warning = normalizedLimit && total > entries.length
    ? `Solo se verificaron las ${entries.length} entradas mas recientes de ${total}. Use full=true para una verificacion completa.`
    : undefined;

  return saveIntegritySnapshot(
    prisma,
    { valid: true, checked: entries.length, total, warning },
    normalizedLimit,
  );
}

async function saveIntegritySnapshot(
  prisma: PrismaService,
  result: Omit<AuditIntegrityResult, 'verifiedAt' | 'verificationScope'>,
  limit?: number,
): Promise<AuditIntegrityResult> {
  const verifiedAt = new Date();
  const verificationScope = limit ? `LIMIT_${limit}` : 'FULL';
  const payload = {
    valid: result.valid,
    checked: result.checked,
    total: result.total,
    brokenAt: result.brokenAt ?? null,
    warning: result.warning ?? null,
    verificationScope,
    verifiedAt,
  };

  if (supportsRawQueries(prisma)) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO audit_integrity_snapshots (id, valid, checked, total, broken_at, warning, verification_scope, verified_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT(id) DO UPDATE SET valid = excluded.valid, checked = excluded.checked, total = excluded.total, broken_at = excluded.broken_at, warning = excluded.warning, verification_scope = excluded.verification_scope, verified_at = excluded.verified_at',
      'latest',
      payload.valid,
      payload.checked,
      payload.total,
      payload.brokenAt,
      payload.warning,
      payload.verificationScope,
      verifiedAt,
    );
  } else {
    await prisma.auditIntegritySnapshot.upsert({
      where: { id: 'latest' },
      create: {
        id: 'latest',
        ...payload,
      },
      update: payload,
    });
  }

  return {
    ...result,
    verifiedAt,
    verificationScope,
  };
}
