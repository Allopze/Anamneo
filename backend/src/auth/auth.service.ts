import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UsersSessionService } from '../users/users-session.service';
import { UsersInvitationService } from '../users/users-invitation.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterWithInvitationDto } from './dto/register-with-invitation.dto';
import { loginWithLockout } from './auth-login-flow';
import { issueTokensWithSession } from './auth-token-issuance';
import { verify2FALoginFlow } from './auth-2fa-flow';
import { refreshTokensFlow } from './auth-refresh-flow';
import {
  getBootstrapStateFlow,
  getInvitationPreviewFlow,
  registerWithInvitationFlow,
} from './auth-register-flow';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  rv?: number;
  sid?: string;
  sv?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  role: string;
  isAdmin: boolean;
  medicoId: string | null;
  mustChangePassword: boolean;
  totpEnabled: boolean;
}

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

const TEMP_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AuthService {
  private usedTempTokenJtis = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private sessionService: UsersSessionService,
    private invitationService: UsersInvitationService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  private toSessionUser(user: {
    id: string;
    email: string;
    nombre: string;
    role: string;
    isAdmin?: boolean | null;
    medicoId?: string | null;
    mustChangePassword?: boolean | null;
    totpEnabled?: boolean | null;
    active?: boolean | null;
  }): SessionUser {
    if (!user.active) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      isAdmin: !!user.isAdmin,
      medicoId: user.medicoId ?? null,
      mustChangePassword: !!user.mustChangePassword,
      totpEnabled: !!user.totpEnabled,
    };
  }

  async getSessionUserByEmail(email: string): Promise<SessionUser> {
    const user = await this.usersService.findByEmail(this.normalizeEmail(email));

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return this.toSessionUser(user);
  }

  async getSessionUserById(userId: string): Promise<SessionUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return this.toSessionUser(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getConfiguredBootstrapToken(): string | null {
    const token = this.configService.get<string>('BOOTSTRAP_TOKEN')?.trim();
    return token ? token : null;
  }

  private hasValidBootstrapToken(candidateToken: string | undefined, expectedToken: string | null) {
    if (!expectedToken) {
      return true;
    }

    const normalizedCandidate = candidateToken?.trim();
    if (!normalizedCandidate) {
      return false;
    }

    const expectedBuffer = Buffer.from(expectedToken);
    const candidateBuffer = Buffer.from(normalizedCandidate);
    if (expectedBuffer.length !== candidateBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
  }

  async getInvitationPreview(token: string) {
    return getInvitationPreviewFlow({
      invitationService: this.invitationService,
      token,
    });
  }

  async register(registerDto: RegisterWithInvitationDto, sessionContext?: SessionContext): Promise<AuthTokens> {
    return registerWithInvitationFlow({
      usersService: this.usersService,
      invitationService: this.invitationService,
      registerDto,
      sessionContext,
      issueTokens: (user, context) => this.issueTokens(user, context),
      normalizeEmail: (email) => this.normalizeEmail(email),
      getConfiguredBootstrapToken: () => this.getConfiguredBootstrapToken(),
      hasValidBootstrapToken: (candidate, expected) => this.hasValidBootstrapToken(candidate, expected),
    });
  }

  async getBootstrapState() {
    return getBootstrapStateFlow({
      usersService: this.usersService,
      getConfiguredBootstrapToken: () => this.getConfiguredBootstrapToken(),
    });
  }

  async login(loginDto: LoginDto, sessionContext?: SessionContext): Promise<AuthTokens | { requires2FA: true; tempToken: string }> {
    return loginWithLockout({
      prisma: this.prisma,
      usersService: this.usersService,
      jwtService: this.jwtService,
      auditService: this.auditService,
      loginDto,
      sessionContext,
      validateUser: async (email, password) => {
        const user = await this.usersService.findByEmail(email);
        if (!user || !user.active) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        return user;
      },
      issueTokens: (user, context) => this.issueTokens(user, context),
      normalizeEmail: (email) => this.normalizeEmail(email),
    });
  }

  async refreshTokens(refreshToken: string, sessionContext?: SessionContext): Promise<AuthTokens> {
    return refreshTokensFlow({
      jwtService: this.jwtService,
      configService: this.configService,
      sessionService: this.sessionService,
      refreshToken,
      sessionContext,
      issueTokens: (user, context) => this.issueTokens(user, context),
    });
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.sessionService.findAuthById(payload.sub);
      if (!user || !user.active) {
        return;
      }

      if (typeof payload.sid === 'string') {
        await this.sessionService.revokeSessionById(payload.sid);
      } else {
        await this.sessionService.rotateRefreshTokenVersion(user.id);
      }

      // Audit logout
      this.auditService
        .log({
          entityType: 'Auth',
          entityId: user.id,
          userId: user.id,
          action: 'LOGOUT',
          diff: { email: user.email },
        })
        .catch(() => {});
    } catch {
      // Ignore invalid/expired tokens on logout.
    }
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.sessionService.rotateRefreshTokenVersion(userId);
    await this.sessionService.revokeAllSessionsForUser(userId);
  }

  private async issueTokens(
    user: { id: string; email: string; role: string },
    sessionContext?: SessionContext,
  ): Promise<AuthTokens> {
    return issueTokensWithSession({
      sessionService: this.sessionService,
      jwtService: this.jwtService,
      configService: this.configService,
      user,
      sessionContext,
    });
  }

  // ── 2FA / TOTP ──────────────────────────────────────────────────────

  async verify2FALogin(
    tempToken: string,
    code: string,
    sessionContext?: SessionContext,
  ): Promise<{ tokens: AuthTokens; userId: string }> {
    return verify2FALoginFlow({
      jwtService: this.jwtService,
      prisma: this.prisma,
      usedTempTokenJtis: this.usedTempTokenJtis,
      tempTokenTtlMs: TEMP_TOKEN_TTL_MS,
      tempToken,
      code,
      sessionContext,
      issueTokens: (user, context) => this.issueTokens(user, context),
    });
  }
}
