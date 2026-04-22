import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { UsersSessionService } from '../users/users-session.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  rv?: number;
  sid?: string;
  sv?: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

interface IssueTokensWithSessionParams {
  sessionService: UsersSessionService;
  jwtService: JwtService;
  configService: ConfigService;
  user: { id: string; email: string; role: string };
  sessionContext?: SessionContext;
}

export async function issueTokensWithSession(
  params: IssueTokensWithSessionParams,
): Promise<AuthTokens> {
  const {
    sessionService,
    jwtService,
    configService,
    user,
    sessionContext,
  } = params;

  const authUser = await sessionService.findAuthById(user.id);
  if (!authUser || !authUser.active) {
    throw new UnauthorizedException('Usuario no encontrado o inactivo');
  }

  const session = sessionContext?.sessionId
    ? await sessionService.rotateSessionTokenVersion(sessionContext.sessionId, sessionContext)
    : await sessionService.createSession(authUser.id, sessionContext);

  if (!session || session.userId !== authUser.id) {
    throw new UnauthorizedException('Sesión inválida');
  }

  const payload: JwtPayload = {
    sub: authUser.id,
    email: user.email,
    role: user.role,
    sid: session.id,
  };

  const refreshPayload: JwtPayload = {
    ...payload,
    rv: authUser.refreshTokenVersion,
    sid: session.id,
    sv: session.tokenVersion,
  };

  const accessToken = jwtService.sign(payload);
  const refreshToken = jwtService.sign(refreshPayload, {
    secret: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    expiresIn: configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
  });

  return { accessToken, refreshToken };
}
