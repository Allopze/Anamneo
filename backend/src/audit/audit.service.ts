import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../common/types';

interface LogInput {
  entityType: string;
  entityId: string;
  userId: string;
  action: AuditAction;
  diff?: any;
}

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
        action: input.action as AuditAction,
        diff: sanitizedDiff ? JSON.stringify(sanitizedDiff) : null,
      },
    });
  }

  async findAll(
    page = 1,
    limit = 50,
    filters?: {
      entityType?: string;
      userId?: string;
      action?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.dateFrom || filters?.dateTo) {
      where.timestamp = {};
      if (filters.dateFrom) where.timestamp.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.timestamp.lte = new Date(filters.dateTo);
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
