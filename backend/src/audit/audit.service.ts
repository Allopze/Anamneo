import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditReason, AuditResult } from '../common/types';
import { getRequestId } from '../common/utils/request-context';
import { inferAuditReason, inferAuditResult } from './audit-catalog';
import { LogInput, sanitizeDiff, parseDateFilter } from './audit-helpers';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: LogInput) {
    const sanitizedDiff = sanitizeDiff(input.entityType, input.diff);
    const reason = input.reason ?? inferAuditReason(input.entityType, input.action, input.diff);

    if (reason === 'AUDIT_UNSPECIFIED') {
      throw new Error(
        `Audit event ${input.entityType}/${input.action} must define an explicit catalog reason`,
      );
    }

    // Get hash of last audit entry for chain
    const lastEntry = await this.prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { integrityHash: true },
    });
    const previousHash = lastEntry?.integrityHash ?? 'GENESIS';

    const data = {
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      requestId: input.requestId ?? getRequestId() ?? null,
      action: input.action as AuditAction,
      reason,
      result: input.result ?? inferAuditResult(input.action),
      diff: sanitizedDiff ? JSON.stringify(sanitizedDiff) : null,
    };

    const integrityHash = crypto
      .createHash('sha256')
      .update(previousHash + JSON.stringify(data))
      .digest('hex');

    return this.prisma.auditLog.create({
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

  async findByUser(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
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

  async verifyChain(limit = 1000): Promise<{ valid: boolean; checked: number; total: number; brokenAt?: string; warning?: string }> {
    const total = await this.prisma.auditLog.count();
    const entries = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'asc' },
      take: limit,
      select: { id: true, integrityHash: true, previousHash: true },
    });

    let expectedPreviousHash = 'GENESIS';
    for (const entry of entries) {
      if (!entry.integrityHash) continue; // skip legacy entries without hash
      if (entry.previousHash !== expectedPreviousHash) {
        return { valid: false, checked: entries.indexOf(entry), total, brokenAt: entry.id };
      }
      expectedPreviousHash = entry.integrityHash;
    }

    const warning = total > entries.length
      ? `Solo se verificaron ${entries.length} de ${total} entradas. Aumente el parámetro limit para una verificación completa.`
      : undefined;

    return { valid: true, checked: entries.length, total, warning };
  }
}
