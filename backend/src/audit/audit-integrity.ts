import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditResult } from '../common/types';

export type AuditLogClient = Prisma.TransactionClient | PrismaService;

export type RawAuditClient = {
  $executeRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

export type IntegrityPayload = {
  entityType: string;
  entityId: string;
  userId: string;
  requestId: string | null;
  action: AuditAction;
  reason: string | null;
  result: AuditResult | null;
  diff: string | null;
};

export type AuditChainHead = {
  previousHash: string;
  nextSequence?: number;
};

export type AuditIntegrityResult = {
  valid: boolean;
  checked: number;
  total: number;
  brokenAt?: string;
  warning?: string;
  verifiedAt: Date;
  verificationScope: string;
};

export type AuditLogRow = {
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

export type AuditChainStateRow = {
  latestHash: string;
  sequence: number;
};

export type AuditCountRow = {
  total: number | string;
};

export type AuditHashRow = {
  integrityHash: string | null;
};

export function buildIntegrityPayload(input: {
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

export function computeIntegrityHash(previousHash: string, payload: IntegrityPayload) {
  return crypto
    .createHash('sha256')
    .update(previousHash + JSON.stringify(payload))
    .digest('hex');
}

export function supportsRootTransactions(client: AuditLogClient): client is PrismaService {
  return '$transaction' in client;
}

export function supportsRawUnsafe(client: unknown): client is {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
} {
  return !!client && typeof (client as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === 'function';
}

export function supportsRawQueries(client: unknown): client is RawAuditClient {
  return !!client
    && typeof (client as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === 'function'
    && typeof (client as { $queryRawUnsafe?: unknown }).$queryRawUnsafe === 'function';
}

export function supportsAuditChainState(client: unknown): boolean {
  return !!client && typeof (client as { auditChainState?: unknown }).auditChainState === 'object';
}
