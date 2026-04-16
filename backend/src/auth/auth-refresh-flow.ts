import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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

type IssueTokensFn = (
  user: { id: string; email: string; role: string },
  sessionContext?: SessionContext,
) => Promise<AuthTokens>;

interface RefreshTokensFlowParams {
  jwtService: JwtService;
  configService: ConfigService;
  sessionService: UsersSessionService;
  refreshToken: string;
  sessionContext?: SessionContext;
  issueTokens: IssueTokensFn;
}

export async function refreshTokensFlow(params: RefreshTokensFlowParams): Promise<AuthTokens> {
  const {
    jwtService,
    configService,
    sessionService,
    refreshToken,
    sessionContext,
    issueTokens,
  } = params;

  try {
    const payload = jwtService.verify<JwtPayload>(refreshToken, {
      secret: configService.get<string>('JWT_REFRESH_SECRET'),
    });

    const user = await sessionService.findAuthById(payload.sub);
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    if (typeof payload.rv !== 'number' || payload.rv !== user.refreshTokenVersion) {
      throw new UnauthorizedException('Token de refresco inválido');
    }

    if (typeof payload.sid !== 'string' || typeof payload.sv !== 'number') {
      throw new UnauthorizedException('Token de refresco inválido');
    }

    const session = await sessionService.findActiveSessionById(payload.sid);
    if (!session || session.userId !== user.id || session.tokenVersion !== payload.sv) {
      throw new UnauthorizedException('Token de refresco inválido');
    }

    return issueTokens(user, {
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
