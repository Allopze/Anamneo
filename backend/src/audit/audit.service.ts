import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditResult } from '../common/types';
import { getRequestId } from '../common/utils/request-context';
import { inferAuditReason, inferAuditResult } from './audit-catalog';
import { LogInput, sanitizeDiff, parseDateFilter } from './audit-helpers';

type AuditLogClient = Prisma.TransactionClient | PrismaService;

type IntegrityPayload = {
  entityType: string;
  entityId: string;
  userId: string;
  requestId: string | null;
  action: AuditAction;
  reason: string | null;
  result: AuditResult | null;
  diff: string | null;
};

type AuditIntegrityResult = {
  valid: boolean;
  checked: number;
  total: number;
  brokenAt?: string;
  warning?: string;
  verifiedAt: Date;
  verificationScope: string;
};

function buildIntegrityPayload(input: {
  entityType: string;
  entityId: string;
  userId: string;
  requestId: string | null;
  action: AuditAction;
  reason: string | null;
  result: AuditResult | null;
  diff: unknown;
}): IntegrityPayload {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.userId,
    requestId: input.requestId,
    action: input.action,
    reason: input.reason,
    result: input.result,
    diff: input.diff ? JSON.stringify(input.diff) : null,
  };
}

function computeIntegrityHash(previousHash: string, payload: IntegrityPayload) {
  return crypto
    .createHash('sha256')
    .update(previousHash + JSON.stringify(payload))
    .digest('hex');
}

function supportsRootTransactions(client: AuditLogClient): client is PrismaService {
  return '$transaction' in client;
}

function supportsRawUnsafe(client: unknown): client is {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
} {
  return !!client && typeof (client as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === 'function';
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: LogInput, client: AuditLogClient = this.prisma) {
    if (supportsRootTransactions(client)) {
      return client.$transaction(async (tx) => this.appendLog(input, tx));
    }

    return this.appendLog(input, client);
  }

  private async appendLog(input: LogInput, client: Prisma.TransactionClient) {
    const sanitizedDiff = sanitizeDiff(input.entityType, input.diff);
    const reason = input.reason ?? inferAuditReason(input.entityType, input.action, input.diff);

    if (reason === 'AUDIT_UNSPECIFIED') {
      throw new Error(
        `Audit event ${input.entityType}/${input.action} must define an explicit catalog reason`,
      );
    }

    // Force SQLite to upgrade the surrounding transaction to a write lock
    // before reading the chain head, so concurrent appends cannot fork it.
    if (supportsRawUnsafe(client)) {
      await client.$executeRawUnsafe('DELETE FROM audit_logs WHERE 1 = 0');
    }

    const lastEntry = await client.auditLog.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { integrityHash: true },
    });
    const previousHash = lastEntry?.integrityHash ?? 'GENESIS';

    const data = buildIntegrityPayload({
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      requestId: input.requestId ?? getRequestId() ?? null,
      action: input.action as AuditAction,
      reason,
      result: input.result ?? inferAuditResult(input.action),
      diff: sanitizedDiff,
    });

    const integrityHash = computeIntegrityHash(previousHash, data);

    return client.auditLog.create({
      data: {
        ...data,
        integrityHash,
        previousHash,
      } as Prisma.AuditLogUncheckedCreateInput,
    });
  }

  async findAll(
    page = 1,
    limit = 50,
    filters?: {
      entityType?: string;
      userId?: string;
      action?: string;
      reason?: string;
      result?: string;
      requestId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.reason) where.reason = filters.reason;
    if (filters?.result) where.result = filters.result;
    if (filters?.requestId) where.requestId = { contains: filters.requestId.trim() };
    if (filters?.dateFrom || filters?.dateTo) {
      where.timestamp = {};
      if (filters.dateFrom) where.timestamp.gte = parseDateFilter(filters.dateFrom, 'start');
      if (filters.dateTo) where.timestamp.lte = parseDateFilter(filters.dateTo, 'end');
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getLatestIntegritySnapshot() {
    return this.prisma.auditIntegritySnapshot.findUnique({
      where: { id: 'latest' },
    });
  }

  async verifyChain(limit?: number): Promise<AuditIntegrityResult> {
    const total = await this.prisma.auditLog.count();
    const normalizedLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? Math.trunc(limit)
      : undefined;
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
    } satisfies Prisma.AuditLogSelect;
    const rawEntries = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: normalizedLimit ? 'desc' : 'asc' },
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
      if (!entry.integrityHash) continue; // skip legacy entries without hash
      if (entry.previousHash !== expectedPreviousHash) {
        return this.saveIntegritySnapshot(
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
        return this.saveIntegritySnapshot(
          { valid: false, checked: index, total, brokenAt: entry.id },
          normalizedLimit,
        );
      }
      expectedPreviousHash = entry.integrityHash;
    }

    const warning = normalizedLimit && total > entries.length
      ? `Solo se verificaron las ${entries.length} entradas mas recientes de ${total}. Use full=true para una verificacion completa.`
      : undefined;

    return this.saveIntegritySnapshot(
      { valid: true, checked: entries.length, total, warning },
      normalizedLimit,
    );
  }

  private async saveIntegritySnapshot(
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

    await this.prisma.auditIntegritySnapshot.upsert({
      where: { id: 'latest' },
      create: {
        id: 'latest',
        ...payload,
      },
      update: payload,
    });

    return {
      ...result,
      verifiedAt,
      verificationScope,
    };
  }
}
