import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditReason, AuditResult } from '../common/types';
import { getRequestId } from '../common/utils/request-context';
import { inferAuditReason, inferAuditResult } from './audit-catalog';

interface LogInput {
  entityType: string;
  entityId: string;
  userId: string;
  action: AuditAction;
  reason?: AuditReason;
  result?: AuditResult;
  diff?: any;
  requestId?: string;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const CLINICAL_ENTITY_TYPES = new Set([
  'Patient',
  'PatientHistory',
  'Encounter',
  'EncounterSection',
  'PatientProblem',
  'EncounterTask',
]);
const SAFE_CLINICAL_STRING_KEYS = new Set([
  'id',
  'patientId',
  'encounterId',
  'createdById',
  'archivedById',
  'reviewRequestedById',
  'reviewedById',
  'completedById',
  'uploadedById',
  'linkedOrderId',
  'linkedOrderType',
  'linkedOrderLabel',
  'status',
  'reviewStatus',
  'sectionKey',
  'scope',
  'format',
  'mime',
  'category',
  'type',
  'priority',
  'result',
  'reason',
  'createdAt',
  'updatedAt',
  'archivedAt',
  'restoredAt',
  'previousArchivedAt',
  'reviewRequestedAt',
  'reviewedAt',
  'completedAt',
  'dueDate',
  'onsetDate',
 ]);
const SENSITIVE_FIELDS = ['passwordHash', 'password', 'refreshToken', 'accessToken'];

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: LogInput) {
    // Remove sensitive data from diff
    const sanitizedDiff = this.sanitizeDiff(input.entityType, input.diff);
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
      if (filters.dateFrom) where.timestamp.gte = this.parseDateFilter(filters.dateFrom, 'start');
      if (filters.dateTo) where.timestamp.lte = this.parseDateFilter(filters.dateTo, 'end');
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

  private sanitizeDiff(entityType: string, diff: any): any {
    if (!diff) return null;

    const sanitized = JSON.parse(JSON.stringify(diff));
    const shouldMinimizeClinicalPayload = CLINICAL_ENTITY_TYPES.has(entityType);

    if (shouldMinimizeClinicalPayload) {
      return this.minimizeClinicalDiff(entityType, sanitized);
    }

    const removeSensitive = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key of SENSITIVE_FIELDS) {
        if (key in obj) {
          obj[key] = '[REDACTED]';
        }
      }

      for (const value of Object.values(obj)) {
        if (typeof value === 'object') {
          removeSensitive(value);
        }
      }
    };

    removeSensitive(sanitized);
    return sanitized;
  }

  private parseDateFilter(value: string, boundary: 'start' | 'end') {
    if (DATE_ONLY_PATTERN.test(value)) {
      const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
      return new Date(`${value}T${time}Z`);
    }

    return new Date(value);
  }

  private minimizeClinicalDiff(entityType: string, diff: any) {
    if (typeof diff !== 'object' || diff === null) {
      return {
        redacted: true,
        entityType,
        valueType: typeof diff,
      };
    }

    const summarized = this.summarizeClinicalValue(diff, undefined);
    if (typeof summarized !== 'object' || summarized === null || Array.isArray(summarized)) {
      return {
        redacted: true,
        entityType,
        summary: summarized,
      };
    }

    return {
      entityType,
      ...summarized,
    };
  }

  private summarizeClinicalValue(value: unknown, key?: string): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      if (key && this.shouldKeepClinicalStringValue(key, value)) {
        return value;
      }

      return {
        redacted: true,
        length: value.length,
      };
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return {
        redacted: true,
        itemCount: value.length,
      };
    }

    if (typeof value !== 'object') {
      return {
        redacted: true,
        valueType: typeof value,
      };
    }

    const summary: Record<string, unknown> = {
      redacted: true,
      fieldCount: Object.keys(value).length,
    };

    for (const [childKey, childValue] of Object.entries(value)) {
      if (SENSITIVE_FIELDS.includes(childKey)) {
        summary[childKey] = '[REDACTED]';
        continue;
      }

      summary[childKey] = this.summarizeClinicalValue(childValue, childKey);
    }

    return summary;
  }

  private shouldKeepClinicalStringValue(key: string, value: string) {
    return SAFE_CLINICAL_STRING_KEYS.has(key)
      || DATE_ONLY_PATTERN.test(value)
      || ISO_DATE_TIME_PATTERN.test(value);
  }

  async verifyChain(limit = 1000): Promise<{ valid: boolean; checked: number; brokenAt?: string }> {
    const entries = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'asc' },
      take: limit,
      select: { id: true, integrityHash: true, previousHash: true },
    });

    let expectedPreviousHash = 'GENESIS';
    for (const entry of entries) {
      if (!entry.integrityHash) continue; // skip legacy entries without hash
      if (entry.previousHash !== expectedPreviousHash) {
        return { valid: false, checked: entries.indexOf(entry), brokenAt: entry.id };
      }
      expectedPreviousHash = entry.integrityHash;
    }

    return { valid: true, checked: entries.length };
  }
}
