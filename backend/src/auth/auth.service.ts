import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UsersSessionService } from '../users/users-session.service';
import { UsersInvitationService } from '../users/users-invitation.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { LoginDto } from './dto/login.dto';
import { RegisterWithInvitationDto } from './dto/register-with-invitation.dto';
import { loginWithLockout } from './auth-login-flow';
import { issueTokensWithSession } from './auth-token-issuance';
import { verify2FALoginFlow } from './auth-2fa-flow';
import { refreshTokensFlow } from './auth-refresh-flow';
import { decryptStoredTotpSecret } from './auth-totp-secret';
import {
  getBootstrapStateFlow,
  getInvitationPreviewFlow,
  registerWithInvitationFlow,
} from './auth-register-flow';
import {
  getConfiguredBootstrapToken,
  hasValidBootstrapToken,
  normalizeEmail,
  toSessionUser,
  type SessionUser,
} from './auth.service.helpers';
export type { SessionUser } from './auth.service.helpers';

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
    private settingsService: SettingsService,
  ) {}

  async getSessionUserByEmail(email: string): Promise<SessionUser> {
    const user = await this.usersService.findByEmail(normalizeEmail(email));

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return toSessionUser(user);
  }

  async getSessionUserById(userId: string): Promise<SessionUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return toSessionUser(user);
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
      normalizeEmail,
      getConfiguredBootstrapToken: () => getConfiguredBootstrapToken(this.configService),
      hasValidBootstrapToken,
    });
  }

  async getBootstrapState() {
    return getBootstrapStateFlow({
      usersService: this.usersService,
      getConfiguredBootstrapToken: () => getConfiguredBootstrapToken(this.configService),
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
      normalizeEmail,
    });
  }

  async refreshTokens(refreshToken: string, sessionContext?: SessionContext): Promise<AuthTokens> {
    const { inactivityTimeoutMinutes } = await this.settingsService.getSessionPolicy();

    return refreshTokensFlow({
      jwtService: this.jwtService,
      configService: this.configService,
      sessionService: this.sessionService,
      refreshToken,
      sessionContext,
      issueTokens: (user, context) => this.issueTokens(user, context),
      sessionInactivityTimeoutMinutes: inactivityTimeoutMinutes,
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

  async revokeOtherUserSessions(userId: string, currentSessionId?: string) {
    if (!currentSessionId) {
      throw new BadRequestException('Sesión actual no disponible');
    }

    return this.sessionService.revokeAllSessionsForUserExcept(userId, currentSessionId);
  }

  async listUserSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.sessionService.listActiveSessionsForUser(userId);

    return sessions.map((session) => ({
      ...session,
      isCurrent: !!currentSessionId && session.id === currentSessionId,
    }));
  }

  async revokeUserSession(userId: string, sessionId: string, currentSessionId?: string) {
    if (currentSessionId && sessionId === currentSessionId) {
      throw new BadRequestException('Usa cerrar sesión para finalizar la sesión actual');
    }

    const revoked = await this.sessionService.revokeOwnedSession(userId, sessionId);
    if (!revoked) {
      throw new NotFoundException('Sesión no encontrada');
    }

    return { id: sessionId, message: 'Sesión revocada' };
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
      resolveTotpSecret: (storedSecret) => decryptStoredTotpSecret(storedSecret, this.configService),
    });
  }
}
