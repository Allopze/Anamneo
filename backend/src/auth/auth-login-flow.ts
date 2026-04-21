import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type AuthIdentity = {
  id: string;
  email: string;
  role: string;
  active?: boolean | null;
};

type ValidateUserFn = (email: string, password: string) => Promise<AuthIdentity | null>;
type IssueTokensFn = (user: AuthIdentity, sessionContext?: SessionContext) => Promise<AuthTokens>;
type NormalizeEmailFn = (email: string) => string;

interface LoginWithLockoutParams {
  prisma: PrismaService;
  usersService: UsersService;
  jwtService: JwtService;
  auditService: AuditService;
  loginDto: LoginDto;
  sessionContext?: SessionContext;
  validateUser: ValidateUserFn;
  issueTokens: IssueTokensFn;
  normalizeEmail: NormalizeEmailFn;
}

export async function clearExpiredLockout(prisma: PrismaService, email: string, now: Date) {
  const loginAttempt = await prisma.loginAttempt.findUnique({
    where: { email },
  });

  if (!loginAttempt) {
    return null;
  }

  if (loginAttempt.lockedUntil && loginAttempt.lockedUntil > now) {
    return loginAttempt;
  }

  if (loginAttempt.lockedUntil && loginAttempt.lockedUntil <= now) {
    await prisma.loginAttempt.update({
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

export async function registerFailedLoginAttempt(prisma: PrismaService, email: string, now: Date) {
  const existingAttempt = await prisma.loginAttempt.findUnique({
    where: { email },
  });

  const shouldResetCounter = Boolean(
    existingAttempt?.lockedUntil && existingAttempt.lockedUntil <= now,
  );

  const nextAttempts = (shouldResetCounter ? 0 : existingAttempt?.failedAttempts ?? 0) + 1;
  const lockedUntil = nextAttempts >= MAX_FAILED_ATTEMPTS
    ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
    : null;

  await prisma.loginAttempt.upsert({
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

export async function resetFailedLoginAttempts(prisma: PrismaService, email: string) {
  await prisma.loginAttempt.deleteMany({
    where: { email },
  });
}

export async function loginWithLockout(
  params: LoginWithLockoutParams,
): Promise<AuthTokens | { requires2FA: true; tempToken: string }> {
  const {
    prisma,
    usersService,
    jwtService,
    auditService,
    loginDto,
    sessionContext,
    validateUser,
    issueTokens,
    normalizeEmail,
  } = params;

  const email = normalizeEmail(loginDto.email);
  const now = new Date();

  const lockout = await clearExpiredLockout(prisma, email, now);
  if (lockout?.lockedUntil) {
    const remainingMin = Math.ceil((lockout.lockedUntil.getTime() - now.getTime()) / 60000);
    throw new UnauthorizedException(
      `Cuenta bloqueada temporalmente. Intente en ${remainingMin} minuto(s).`,
    );
  }

  const user = await validateUser(email, loginDto.password);
  if (!user) {
    const entry = await registerFailedLoginAttempt(prisma, email, now);
    const existingUser = await usersService.findByEmail(email);

    auditService
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
      .catch(() => {});

    throw new UnauthorizedException('Credenciales inválidas');
  }

  await resetFailedLoginAttempts(prisma, email);

  auditService
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
    .catch(() => {});

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });

  if (fullUser?.totpEnabled) {
    const jti = crypto.randomUUID();
    const tempToken = jwtService.sign(
      { sub: user.id, purpose: '2fa', jti },
      { expiresIn: '5m' },
    );
    return { requires2FA: true, tempToken };
  }

  return issueTokens(user, sessionContext);
}
