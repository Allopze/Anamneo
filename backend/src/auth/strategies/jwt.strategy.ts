import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { Request } from 'express';

// Extract JWT strictly from HttpOnly cookie — no Bearer fallback
function extractJwtFromCookie(req: Request): string | null {
  return req?.cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookie,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario no autorizado');
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
      sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
    };
  }
}
