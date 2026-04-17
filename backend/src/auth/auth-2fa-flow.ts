import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from '@otplib/v12-adapter';
import { PrismaService } from '../prisma/prisma.service';

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

interface Verify2FALoginFlowParams {
  jwtService: JwtService;
  prisma: PrismaService;
  usedTempTokenJtis: Map<string, number>;
  tempTokenTtlMs: number;
  tempToken: string;
  code: string;
  sessionContext?: SessionContext;
  issueTokens: IssueTokensFn;
}

function purgeExpiredTempTokenJtis(usedTempTokenJtis: Map<string, number>, now: number) {
  for (const [jti, expiresAt] of usedTempTokenJtis) {
    if (expiresAt <= now) {
      usedTempTokenJtis.delete(jti);
    }
  }
}

export async function verify2FALoginFlow(
  params: Verify2FALoginFlowParams,
): Promise<{ tokens: AuthTokens; userId: string }> {
  const {
    jwtService,
    prisma,
    usedTempTokenJtis,
    tempTokenTtlMs,
    tempToken,
    code,
    sessionContext,
    issueTokens,
  } = params;
  const now = Date.now();

  purgeExpiredTempTokenJtis(usedTempTokenJtis, now);

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
    if (usedTempTokenJtis.has(payload.jti)) {
      throw new UnauthorizedException('Token temporal ya utilizado');
    }
    usedTempTokenJtis.set(payload.jti, now + tempTokenTtlMs);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active || !user.totpEnabled || !user.totpSecret) {
    throw new UnauthorizedException('Usuario no encontrado o 2FA no configurado');
  }

  const isValid = authenticator.verify({ token: code, secret: user.totpSecret });
  if (!isValid) {
    throw new UnauthorizedException('Código TOTP inválido');
  }

  return {
    tokens: await issueTokens(user, sessionContext),
    userId: user.id,
  };
}
