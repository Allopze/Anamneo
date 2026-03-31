import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: LogInput) {
    // Remove sensitive data from diff
    const sanitizedDiff = this.sanitizeDiff(input.entityType, input.diff);

    return this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        requestId: input.requestId ?? getRequestId() ?? null,
        action: input.action as AuditAction,
        reason: input.reason ?? inferAuditReason(input.entityType, input.action, input.diff),
        result: input.result ?? inferAuditResult(input.action),
        diff: sanitizedDiff ? JSON.stringify(sanitizedDiff) : null,
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
    const shouldMinimizeClinicalPayload = ['Patient', 'PatientHistory', 'EncounterSection'].includes(entityType);

    if (shouldMinimizeClinicalPayload) {
      return this.minimizeClinicalDiff(entityType, sanitized);
    }

    const sensitiveFields = ['passwordHash', 'password', 'refreshToken', 'accessToken'];

    const removeSensitive = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key of sensitiveFields) {
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
    const summarizeRecord = (value: any) => {
      if (typeof value !== 'object' || value === null) {
        return value ?? null;
      }

      const summary: Record<string, unknown> = {
        redacted: true,
        entityType,
      };

      for (const key of ['id', 'patientId', 'encounterId', 'sectionKey', 'createdAt', 'updatedAt']) {
        if (key in value) {
          summary[key] = value[key];
        }
      }

      summary.fieldCount = Object.keys(value).length;
      return summary;
    };

    if (typeof diff !== 'object' || diff === null) {
      return { redacted: true, entityType };
    }

    const summarized: Record<string, unknown> = { redacted: true, entityType };

    for (const [key, value] of Object.entries(diff)) {
      summarized[key] = summarizeRecord(value);
    }

    return summarized;
  }
}
