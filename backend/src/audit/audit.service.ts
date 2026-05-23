import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditResult } from '../common/types';
import { getRequestId } from '../common/utils/request-context';
import { inferAuditReason, inferAuditResult } from './audit-catalog';
import { LogInput, sanitizeDiff, parseDateFilter } from './audit-helpers';

type AuditLogClient = Prisma.TransactionClient | PrismaService;

type RawAuditClient = {
  $executeRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

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

type AuditChainHead = {
  previousHash: string;
  nextSequence?: number;
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

function supportsRawQueries(client: unknown): client is RawAuditClient {
  return !!client
    && typeof (client as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === 'function'
    && typeof (client as { $queryRawUnsafe?: unknown }).$queryRawUnsafe === 'function';
}

type AuditLogRow = {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  requestId: string | null;
  action: string;
  reason: string | null;
  result: string;
  diff: string | null;
  integrityHash: string | null;
  previousHash: string | null;
  chainSequence: number | null;
  timestamp: Date;
};

type AuditChainStateRow = {
  latestHash: string;
  sequence: number;
};

type AuditCountRow = {
  total: number | string;
};

type AuditHashRow = {
  integrityHash: string | null;
};

function supportsAuditChainState(client: unknown): boolean {
  return !!client && typeof (client as { auditChainState?: unknown }).auditChainState === 'object';
}

@Injectable()
export class AuditService {
  private auditWriteQueue: Promise<void> = Promise.resolve();

  constructor(private prisma: PrismaService) {}

  async log(input: LogInput, client: AuditLogClient = this.prisma) {
    return this.enqueueAuditWrite(async () => this.writeLog(input, client));
  }

  private enqueueAuditWrite<T>(operation: () => Promise<T>): Promise<T> {
    const queuedOperation = this.auditWriteQueue.then(operation, operation);
    this.auditWriteQueue = queuedOperation.then(
      () => undefined,
      () => undefined,
    );
    return queuedOperation;
  }

  private async writeLog(input: LogInput, client: AuditLogClient) {
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

    const chainHead = await this.acquireAuditChainHead(client);
    const previousHash = chainHead.previousHash;

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

    if (supportsRawQueries(client)) {
      const entryId = crypto.randomUUID();
      await client.$executeRawUnsafe(
        'INSERT INTO audit_logs (id, entity_type, entity_id, user_id, request_id, action, reason, result, diff, integrity_hash, previous_hash, chain_sequence, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        entryId,
        data.entityType,
        data.entityId,
        data.userId,
        data.requestId,
        data.action,
        data.reason,
        data.result,
        data.diff,
        integrityHash,
        previousHash,
        chainHead.nextSequence ?? null,
        new Date(),
      );

      if (chainHead.nextSequence) {
        await client.$executeRawUnsafe(
          'INSERT INTO audit_chain_state (id, latest_hash, sequence, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET latest_hash = excluded.latest_hash, sequence = excluded.sequence, updated_at = CURRENT_TIMESTAMP',
          'default',
          integrityHash,
          chainHead.nextSequence,
        );
      }

      const [entry] = await client.$queryRawUnsafe<AuditLogRow[]>(
        'SELECT id, entity_type AS "entityType", entity_id AS "entityId", user_id AS "userId", request_id AS "requestId", action, reason, result, diff, integrity_hash AS "integrityHash", previous_hash AS "previousHash", chain_sequence AS "chainSequence", timestamp FROM audit_logs WHERE id = $1 LIMIT 1',
        entryId,
      );

      return {
        ...entry,
        timestamp: new Date(entry.timestamp),
      };
    }

    const entry = await client.auditLog.create({
      data: {
        ...data,
        integrityHash,
        previousHash,
        chainSequence: chainHead.nextSequence,
      } as Prisma.AuditLogUncheckedCreateInput,
    });

    if (supportsAuditChainState(client) && chainHead.nextSequence) {
      await (client as any).auditChainState.update({
        where: { id: 'default' },
        data: {
          latestHash: integrityHash,
          sequence: chainHead.nextSequence,
        },
      });
    }

    return entry;
  }

  private async acquireAuditChainHead(client: Prisma.TransactionClient): Promise<AuditChainHead> {
    if (supportsRawQueries(client)) {
      await client.$executeRawUnsafe(
        'INSERT INTO audit_chain_state (id, latest_hash, sequence, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING',
        'default',
        'GENESIS',
        0,
      );

      let state = (await client.$queryRawUnsafe<AuditChainStateRow[]>(
        'SELECT latest_hash AS "latestHash", sequence FROM audit_chain_state WHERE id = $1 LIMIT 1 FOR UPDATE',
        'default',
      ))[0];

      if (state.sequence === 0) {
        const [{ total: totalRows } = { total: 0 }] = await client.$queryRawUnsafe<AuditCountRow[]>(
          'SELECT COUNT(*) AS total FROM audit_logs',
        );
        const [lastEntry] = await client.$queryRawUnsafe<AuditHashRow[]>(
          'SELECT integrity_hash AS "integrityHash" FROM audit_logs WHERE integrity_hash IS NOT NULL ORDER BY timestamp DESC LIMIT 1',
        );
        const existingEntries = Number(totalRows);

        if (existingEntries > 0 || lastEntry?.integrityHash) {
          state = {
            latestHash: lastEntry?.integrityHash ?? 'GENESIS',
            sequence: existingEntries,
          };
          await client.$executeRawUnsafe(
            'UPDATE audit_chain_state SET latest_hash = $1, sequence = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            state.latestHash,
            state.sequence,
            'default',
          );
        }
      }

      return {
        previousHash: state.latestHash,
        nextSequence: state.sequence + 1,
      };
    }

    if (!supportsAuditChainState(client)) {
      const lastEntry = await client.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { integrityHash: true },
      });
      return { previousHash: lastEntry?.integrityHash ?? 'GENESIS' };
    }

    const chainClient = client as any;

    await chainClient.auditChainState.upsert({
      where: { id: 'default' },
      create: { id: 'default', latestHash: 'GENESIS', sequence: 0 },
      update: {},
    });

    if (supportsRawUnsafe(client)) {
      await client.$executeRawUnsafe(
        "UPDATE audit_chain_state SET sequence = sequence WHERE id = 'default'",
      );
    }

    let state = await chainClient.auditChainState.findUnique({
      where: { id: 'default' },
      select: { latestHash: true, sequence: true },
    });

    if (!state) {
      throw new Error('Audit chain state could not be initialized');
    }

    if (state.sequence === 0) {
      const [existingEntries, lastEntry] = await Promise.all([
        chainClient.auditLog.count(),
        chainClient.auditLog.findFirst({
          where: { integrityHash: { not: null } },
          orderBy: { timestamp: 'desc' },
          select: { integrityHash: true },
        }),
      ]);

      if (existingEntries > 0 || lastEntry?.integrityHash) {
        state = await chainClient.auditChainState.update({
          where: { id: 'default' },
          data: {
            latestHash: lastEntry?.integrityHash ?? 'GENESIS',
            sequence: existingEntries,
          },
          select: { latestHash: true, sequence: true },
        });
      }
    }

    return {
      previousHash: state.latestHash,
      nextSequence: state.sequence + 1,
    };
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
    if (supportsRawQueries(this.prisma)) {
      const rawEntries = await this.prisma.$queryRawUnsafe<AuditLogRow[]>(
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
    const rawEntries = await this.prisma.auditLog.findMany({
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

    if (supportsRawQueries(this.prisma)) {
      await this.prisma.$executeRawUnsafe(
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
      await this.prisma.auditIntegritySnapshot.upsert({
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
}
