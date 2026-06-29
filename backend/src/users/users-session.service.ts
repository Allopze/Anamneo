import { Injectable } from '@nestjs/common';
import { decryptNetMeta, encryptNetMeta } from '../common/utils/field-crypto';
import { PrismaService } from '../prisma/prisma.service';

type SessionMetadata = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class UsersSessionService {
  constructor(private prisma: PrismaService) {}

  private normalizeSessionMetadata(metadata?: SessionMetadata) {
    const userAgent = metadata?.userAgent?.trim().slice(0, 255) || null;
    const ipAddress = metadata?.ipAddress?.trim().slice(0, 64) || null;

    return {
      userAgent: encryptNetMeta(userAgent),
      ipAddress: encryptNetMeta(ipAddress),
    };
  }

  async findAuthById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        refreshTokenVersion: true,
      },
    });
  }

  async rotateRefreshTokenVersion(id: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        refreshTokenVersion: {
          increment: 1,
        },
      },
      select: {
        refreshTokenVersion: true,
      },
    });

    return updated.refreshTokenVersion;
  }

  async createSession(userId: string, metadata?: SessionMetadata) {
    const normalized = this.normalizeSessionMetadata(metadata);

    const row = await this.prisma.userSession.create({
      data: {
        userId,
        tokenVersion: 1,
        userAgent: normalized.userAgent,
        ipAddress: normalized.ipAddress,
        lastUsedAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        tokenVersion: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });
    return { ...row, userAgent: decryptNetMeta(row.userAgent), ipAddress: decryptNetMeta(row.ipAddress) };
  }

  async findActiveSessionById(id: string) {
    const row = await this.prisma.userSession.findFirst({
      where: {
        id,
        revokedAt: null,
      },
      select: {
        id: true,
        userId: true,
        tokenVersion: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });
    if (!row) return null;
    return { ...row, userAgent: decryptNetMeta(row.userAgent), ipAddress: decryptNetMeta(row.ipAddress) };
  }

  async rotateSessionTokenVersion(id: string, metadata?: SessionMetadata) {
    const normalized = this.normalizeSessionMetadata(metadata);

    const updated = await this.prisma.userSession.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        tokenVersion: {
          increment: 1,
        },
        lastUsedAt: new Date(),
        ...(normalized.userAgent !== null ? { userAgent: normalized.userAgent } : {}),
        ...(normalized.ipAddress !== null ? { ipAddress: normalized.ipAddress } : {}),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    const row = await this.prisma.userSession.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        tokenVersion: true,
        userAgent: true,
        ipAddress: true,
        revokedAt: true,
      },
    });
    if (!row) return null;
    return { ...row, userAgent: decryptNetMeta(row.userAgent), ipAddress: decryptNetMeta(row.ipAddress) };
  }

  async revokeSessionById(id: string) {
    await this.prisma.userSession.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllSessionsForUser(userId: string) {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllSessionsForUserExcept(userId: string, excludedSessionId: string) {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: {
          not: excludedSessionId,
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count;
  }

  async listActiveSessionsForUser(userId: string) {
    const rows = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({ ...r, userAgent: decryptNetMeta(r.userAgent), ipAddress: decryptNetMeta(r.ipAddress) }));
  }

  async revokeOwnedSession(userId: string, id: string) {
    const updated = await this.prisma.userSession.updateMany({
      where: {
        id,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return updated.count > 0;
  }
}
