import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from '@otplib/v12-adapter';
import { PrismaService } from '../prisma/prisma.service';
import { consumeRecoveryCode, serializeRecoveryCodeHashes } from './auth-recovery-codes';

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type IssueTokensFn = (
  user: { id: string; email: string; role: string },
  sessionContext?: SessionContext,
) => Promise<AuthTokens>;

interface JtiStore {
  hasUsed(jti: string): Promise<boolean>;
  markUsed(jti: string, expiresAt: Date): Promise<void>;
}

interface Verify2FALoginFlowParams {
  jwtService: JwtService;
  prisma: PrismaService;
  jtiStore: JtiStore;
  tempTokenTtlMs: number;
  tempToken: string;
  code: string;
  sessionContext?: SessionContext;
  issueTokens: IssueTokensFn;
  resolveTotpSecret: (storedSecret: string) => string;
}

function isTotpToken(code: string) {
  return /^\d{6}$/.test(code.trim());
}

export async function verify2FALoginFlow(
  params: Verify2FALoginFlowParams,
): Promise<{ tokens: AuthTokens; userId: string }> {
  const {
    jwtService,
    prisma,
    jtiStore,
    tempTokenTtlMs,
    tempToken,
    code,
    sessionContext,
    issueTokens,
    resolveTotpSecret,
  } = params;
  const now = Date.now();

  let payload: { sub: string; purpose: string; jti?: string };
  try {
    payload = jwtService.verify(tempToken);
  } catch {
    throw new UnauthorizedException('Token temporal inválido o expirado');
  }

  if (payload.purpose !== '2fa') {
    throw new UnauthorizedException('Token temporal inválido');
  }

  if (payload.jti) {
    if (await jtiStore.hasUsed(payload.jti)) {
      throw new UnauthorizedException('Token temporal ya utilizado');
    }
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active || !user.totpEnabled || (!user.totpSecret && !user.totpRecoveryCodes)) {
    throw new UnauthorizedException('Usuario no encontrado o 2FA no configurado');
  }

  let recoveryCodeHashesAfterConsume: string[] | null = null;
  let isValid = false;

  if (isTotpToken(code) && user.totpSecret) {
    isValid = authenticator.verify({
      token: code.trim(),
      secret: resolveTotpSecret(user.totpSecret),
    });
  }

  if (!isValid) {
    recoveryCodeHashesAfterConsume = await consumeRecoveryCode(code, user.totpRecoveryCodes);
    isValid = recoveryCodeHashesAfterConsume !== null;
  }

  if (!isValid) {
    throw new UnauthorizedException('Código de verificación inválido');
  }

  if (recoveryCodeHashesAfterConsume !== null) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpRecoveryCodes: serializeRecoveryCodeHashes(recoveryCodeHashesAfterConsume),
      },
    });
  }

  if (payload.jti) {
    await jtiStore.markUsed(payload.jti, new Date(now + tempTokenTtlMs));
  }

  return {
    tokens: await issueTokens(user, sessionContext),
    userId: user.id,
  };
}
