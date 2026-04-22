import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { authenticator } from '@otplib/v12-adapter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decryptStoredTotpSecret, encryptStoredTotpSecret } from './auth-totp-secret';

@Injectable()
export class AuthTotpService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private configService: ConfigService,
  ) {}

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.totpEnabled) throw new BadRequestException('2FA ya está habilitado');

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encryptStoredTotpSecret(secret, this.configService) },
    });

    const otpauthUrl = authenticator.keyuri(user.email, 'Anamneo', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, qrCodeDataUrl };
  }

  async enable2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) throw new BadRequestException('Primero debe configurar 2FA');
    if (user.totpEnabled) throw new BadRequestException('2FA ya está habilitado');

    const resolvedSecret = decryptStoredTotpSecret(user.totpSecret, this.configService);
    const isValid = authenticator.verify({ token: code, secret: resolvedSecret });
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
}
