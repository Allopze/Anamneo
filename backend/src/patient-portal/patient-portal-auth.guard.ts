import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { PatientPortalJwtPayload } from './patient-portal.types';
import { extractBearerToken } from '../common/utils/mobile-client';

@Injectable()
export class PatientPortalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req?.cookies?.patient_access_token ?? extractBearerToken(req);
    if (!token) throw new UnauthorizedException('Sesión de portal paciente requerida');

    let payload: PatientPortalJwtPayload;
    try {
      payload = this.jwtService.verify<PatientPortalJwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Sesión de portal paciente inválida');
    }

    if (payload.typ !== 'patient_portal' || typeof payload.sid !== 'string' || typeof payload.sv !== 'number') {
      throw new UnauthorizedException('Sesión de portal paciente inválida');
    }

    const account = await this.prisma.patientPortalAccount.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, patientId: true, relationship: true, active: true },
    });
    const session = await this.prisma.patientPortalSession.findFirst({
      where: { id: payload.sid, accountId: payload.sub, revokedAt: null },
      select: { id: true, tokenVersion: true },
    });

    if (!account?.active || !session || session.tokenVersion !== payload.sv) {
      throw new UnauthorizedException('Sesión de portal paciente inválida');
    }

    req.patientPortalUser = {
      id: account.id,
      email: account.email,
      patientId: account.patientId,
      relationship: account.relationship,
      sessionId: session.id,
    };
    return true;
  }
}
