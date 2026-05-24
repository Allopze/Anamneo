import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { UsersSessionService } from '../../users/users-session.service';
import { Request } from 'express';
import { extractBearerToken } from '../../common/utils/mobile-client';

// El cliente web usa cookie httpOnly; el cliente móvil envía Bearer en el header
// Authorization. La cookie tiene prioridad para no confundir flujos cuando ambos
// llegan en la misma request.
function extractJwtFromCookieOrBearer(req: Request): string | null {
  return req?.cookies?.access_token ?? extractBearerToken(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
    private sessionService: UsersSessionService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookieOrBearer,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (typeof payload.sid !== 'string' || typeof payload.sv !== 'number') {
      throw new UnauthorizedException('Sesión inválida');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    const session = await this.sessionService.findActiveSessionById(payload.sid);
    if (!session || session.userId !== user.id || session.tokenVersion !== payload.sv) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      isAdmin: user.isAdmin,
      medicoId: user.medicoId ?? null,
      mustChangePassword: user.mustChangePassword ?? false,
      totpEnabled: user.totpEnabled ?? false,
      sessionId: payload.sid,
    };
  }
}
