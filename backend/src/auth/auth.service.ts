import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterWithInvitationDto } from './dto/register-with-invitation.dto';
import { Role } from './dto/register.dto';
import { authenticator } from '@otplib/v12-adapter';

// ── Account lockout ────────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {
    // Purge expired JTIs every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [jti, expiresAt] of this.usedTempTokenJtis) {
        if (expiresAt <= now) this.usedTempTokenJtis.delete(jti);
      }
    }, TEMP_TOKEN_TTL_MS).unref();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async clearExpiredLockout(email: string, now: Date) {
    const loginAttempt = await this.prisma.loginAttempt.findUnique({
      where: { email },
    });

    if (!loginAttempt) {
      return null;
    }

    if (loginAttempt.lockedUntil && loginAttempt.lockedUntil > now) {
      return loginAttempt;
    }

    if (loginAttempt.failedAttempts > 0 || loginAttempt.lockedUntil) {
      await this.prisma.loginAttempt.update({
        where: { email },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
          lastAttemptAt: now,
        },
      });
    }

    return null;
  }

  private async registerFailedLoginAttempt(email: string, now: Date) {
    const existingAttempt = await this.prisma.loginAttempt.findUnique({
      where: { email },
    });

    const shouldResetCounter = Boolean(
      existingAttempt?.lockedUntil && existingAttempt.lockedUntil <= now,
    );

    const nextAttempts = (shouldResetCounter ? 0 : existingAttempt?.failedAttempts ?? 0) + 1;
    const lockedUntil = nextAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : null;

    await this.prisma.loginAttempt.upsert({
      where: { email },
      create: {
        email,
        failedAttempts: nextAttempts,
        lockedUntil,
        lastAttemptAt: now,
      },
      update: {
        failedAttempts: nextAttempts,
        lockedUntil,
        lastAttemptAt: now,
      },
    });

    return {
      attempts: nextAttempts,
      lockedUntil,
    };
  }

  private async resetFailedLoginAttempts(email: string) {
    await this.prisma.loginAttempt.deleteMany({
      where: { email },
    });
  }

  async getInvitationPreview(token: string) {
    const invitation = await this.usersService.findInvitationByToken(token);

    if (!invitation) {
      throw new ForbiddenException('La invitación es inválida o expiró');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      medicoId: invitation.medicoId,
      expiresAt: invitation.expiresAt,
    };
  }

  async register(registerDto: RegisterWithInvitationDto, sessionContext?: SessionContext): Promise<AuthTokens> {
    const normalizedEmail = this.normalizeEmail(registerDto.email);

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    const requestedRole: Role = registerDto.role || 'ASISTENTE';
    const adminCount = await this.usersService.countActiveAdmins();
    const hasAdmin = adminCount > 0;
    const invitationToken = registerDto.invitationToken?.trim();

    let invitation: Awaited<ReturnType<UsersService['findInvitationByToken']>> | null = null;

    if (hasAdmin) {
      if (!invitationToken) {
        throw new ForbiddenException('El registro público está deshabilitado. Debe usar una invitación válida');
      }

      invitation = await this.usersService.findInvitationByToken(invitationToken);
      if (!invitation) {
        throw new ForbiddenException('La invitación es inválida o expiró');
      }

      if (invitation.email !== normalizedEmail) {
        throw new ForbiddenException('El email no coincide con la invitación');
      }

      if (invitation.role !== requestedRole) {
        throw new ForbiddenException('El rol no coincide con la invitación');
      }

      if (invitation.medicoId) {
        const invitedMedico = await this.usersService.findById(invitation.medicoId);

        if (!invitedMedico || invitedMedico.role !== 'MEDICO' || !invitedMedico.active) {
          throw new ForbiddenException('El médico asignado en la invitación ya no está disponible');
        }
      }
    }

    if (requestedRole === 'ADMIN') {
      if (adminCount > 0 && !invitation) {
        throw new ForbiddenException('Ya existe un administrador registrado. El acceso es solo por invitación');
      }
    }

    if (!hasAdmin && requestedRole !== 'ADMIN') {
      throw new ForbiddenException('El primer registro debe crear la cuenta administradora inicial');
    }

    // Create user (users service handles password hashing)
    const user = await this.usersService.create({
      email: normalizedEmail,
      password: registerDto.password,
      nombre: registerDto.nombre,
      role: requestedRole,
      ...(invitation?.medicoId ? { medicoId: invitation.medicoId } : {}),
      ...(requestedRole === 'ASISTENTE' && !invitation?.medicoId ? { allowUnassignedAssistant: true } : {}),
    });

    if (invitation) {
      await this.usersService.acceptInvitation(invitation.id);
    }

    // Generate and return tokens
    return this.issueTokens(user, sessionContext);
  }

  async getBootstrapState() {
    const userCount = await this.usersService.countUsers();
    const adminCount = await this.usersService.countActiveAdmins();
    const hasAdmin = adminCount > 0;
    return {
      userCount,
      isEmpty: userCount === 0,
      hasAdmin,
      registerableRoles: hasAdmin ? ([] as const) : (['ADMIN'] as const),
    };
  }

  async validateUser(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || !user.active) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(loginDto: LoginDto, sessionContext?: SessionContext): Promise<AuthTokens | { requires2FA: true; tempToken: string }> {
    const email = this.normalizeEmail(loginDto.email);
    const now = new Date();

    // Check lockout
    const lockout = await this.clearExpiredLockout(email, now);
    if (lockout?.lockedUntil) {
      const remainingMin = Math.ceil((lockout.lockedUntil.getTime() - now.getTime()) / 60000);
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente. Intente en ${remainingMin} minuto(s).`,
      );
    }

    const user = await this.validateUser(email, loginDto.password);
    if (!user) {
      const entry = await this.registerFailedLoginAttempt(email, now);

      // Audit failed login (look up user to get ID if exists)
      const existingUser = await this.usersService.findByEmail(email);
      this.auditService
        .log({
          entityType: 'Auth',
          entityId: existingUser?.id || 'unknown',
          userId: existingUser?.id || 'unknown',
          action: 'LOGIN_FAILED',
          diff: {
            email,
            attempt: entry.attempts,
            locked: !!entry.lockedUntil,
            ip: sessionContext?.ipAddress || null,
          },
        })
        .catch(() => {}); // fire-and-forget

      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Reset lockout on success
    await this.resetFailedLoginAttempts(email);

    // Audit successful login
    this.auditService
      .log({
        entityType: 'Auth',
        entityId: user.id,
        userId: user.id,
        action: 'LOGIN',
        diff: {
          email: user.email,
          ip: sessionContext?.ipAddress || null,
          userAgent: sessionContext?.userAgent || null,
        },
      })
      .catch(() => {}); // fire-and-forget

    // Check if 2FA is enabled
    const fullUser = await this.prisma.user.findUnique({ where: { id: user.id }, select: { totpEnabled: true } });
    if (fullUser?.totpEnabled) {
      const jti = crypto.randomUUID();
      const tempToken = this.jwtService.sign(
        { sub: user.id, purpose: '2fa', jti },
        { expiresIn: '5m' },
      );
      return { requires2FA: true, tempToken };
    }

    return this.issueTokens(user, sessionContext);
  }

  async refreshTokens(refreshToken: string, sessionContext?: SessionContext): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findAuthById(payload.sub);
      if (!user || !user.active) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      if (typeof payload.rv !== 'number' || payload.rv !== user.refreshTokenVersion) {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      if (typeof payload.sid !== 'string' || typeof payload.sv !== 'number') {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      const session = await this.usersService.findActiveSessionById(payload.sid);
      if (!session || session.userId !== user.id || session.tokenVersion !== payload.sv) {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      return this.issueTokens(user, {
        ...sessionContext,
        sessionId: session.id,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token de refresco inválido');
    }
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findAuthById(payload.sub);
      if (!user || !user.active) {
        return;
      }

      if (typeof payload.sid === 'string') {
        await this.usersService.revokeSessionById(payload.sid);
      } else {
        await this.usersService.rotateRefreshTokenVersion(user.id);
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
    await this.usersService.rotateRefreshTokenVersion(userId);
    await this.usersService.revokeAllSessionsForUser(userId);
  }

  private async issueTokens(
    user: { id: string; email: string; role: string },
    sessionContext?: SessionContext,
  ): Promise<AuthTokens> {
    const authUser = await this.usersService.findAuthById(user.id);
    if (!authUser || !authUser.active) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const session = sessionContext?.sessionId
      ? await this.usersService.rotateSessionTokenVersion(sessionContext.sessionId, sessionContext)
      : await this.usersService.createSession(authUser.id, sessionContext);

    if (!session || session.userId !== authUser.id) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const payload: JwtPayload = {
      sub: authUser.id,
      email: user.email,
      role: user.role,
    };

    const refreshPayload: JwtPayload = {
      ...payload,
      rv: authUser.refreshTokenVersion,
      sid: session.id,
      sv: session.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
    });

    return { accessToken, refreshToken };
  }

  // ── 2FA / TOTP ──────────────────────────────────────────────────────

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.totpEnabled) throw new BadRequestException('2FA ya está habilitado');

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });

    const otpauthUrl = authenticator.keyuri(user.email, 'Anamneo', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, qrCodeDataUrl };
  }

  async enable2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) throw new BadRequestException('Primero debe configurar 2FA');
    if (user.totpEnabled) throw new BadRequestException('2FA ya está habilitado');

    const isValid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!isValid) throw new BadRequestException('Código TOTP inválido');

    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });

    this.auditService.log({
      entityType: 'Auth',
      entityId: userId,
      userId,
      action: 'UPDATE',
      reason: 'AUTH_2FA_ENABLED',
      diff: { totpEnabled: true },
    }).catch(() => {});

    return { message: '2FA habilitado correctamente' };
  }

  async disable2FA(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (!user.totpEnabled) throw new BadRequestException('2FA no está habilitado');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Contraseña incorrecta');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });

    this.auditService.log({
      entityType: 'Auth',
      entityId: userId,
      userId,
      action: 'UPDATE',
      reason: 'AUTH_2FA_DISABLED',
      diff: { totpEnabled: false },
    }).catch(() => {});

    return { message: '2FA deshabilitado correctamente' };
  }

  async verify2FALogin(tempToken: string, code: string, sessionContext?: SessionContext): Promise<AuthTokens> {
    let payload: { sub: string; purpose: string; jti?: string };
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Token temporal inválido o expirado');
    }

    if (payload.purpose !== '2fa') {
      throw new UnauthorizedException('Token temporal inválido');
    }

    // Enforce single-use: reject if jti was already consumed
    if (payload.jti) {
      if (this.usedTempTokenJtis.has(payload.jti)) {
        throw new UnauthorizedException('Token temporal ya utilizado');
      }
      this.usedTempTokenJtis.set(payload.jti, Date.now() + TEMP_TOKEN_TTL_MS);
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('Usuario no encontrado o 2FA no configurado');
    }

    const isValid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!isValid) throw new UnauthorizedException('Código TOTP inválido');

    return this.issueTokens(user, sessionContext);
  }
}
