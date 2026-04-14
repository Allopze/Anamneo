import { Injectable } from '@nestjs/common';
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
      userAgent,
      ipAddress,
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

    return this.prisma.userSession.create({
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
        revokedAt: true,
      },
    });
  }

  async findActiveSessionById(id: string) {
    return this.prisma.userSession.findFirst({
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
        revokedAt: true,
      },
    });
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

    return this.prisma.userSession.findUnique({
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
}
