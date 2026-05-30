import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../common/types';
import { getRequestId } from '../common/utils/request-context';
import { inferAuditReason, inferAuditResult } from './audit-catalog';
import { LogInput, sanitizeDiff, parseDateFilter } from './audit-helpers';
import { verifyAuditChain } from './audit-chain-verifier';
import {
  AuditChainHead,
  AuditChainStateRow,
  AuditCountRow,
  AuditHashRow,
  AuditIntegrityResult,
  AuditLogClient,
  AuditLogRow,
  buildIntegrityPayload,
  computeIntegrityHash,
  supportsAuditChainState,
  supportsRawQueries,
  supportsRawUnsafe,
  supportsRootTransactions,
} from './audit-integrity';
const AUDIT_SERIALIZATION_RETRY_ATTEMPTS = 3;
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
    for (let attempt = 1; attempt <= AUDIT_SERIALIZATION_RETRY_ATTEMPTS; attempt += 1) {
      try {
        if (supportsRootTransactions(client)) {
          return await client.$transaction(async (tx) => this.appendLog(input, tx));
        }
        return await this.appendLog(input, client);
      } catch (error) {
        if (attempt >= AUDIT_SERIALIZATION_RETRY_ATTEMPTS || !this.isSerializationFailure(error)) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 25));
      }
    }
  }
  private isSerializationFailure(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    const metaCode = typeof error.meta?.code === 'string' ? error.meta.code : undefined;
    return error.code === 'P2034' || metaCode === '40001' || error.message.includes('could not serialize access');
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
    return verifyAuditChain(this.prisma, limit);
  }
}
