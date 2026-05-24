import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { encryptNetMeta } from '../common/utils/field-crypto';
import { authenticator } from '@otplib/v12-adapter';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { UsersSessionService } from '../users/users-session.service';
import {
  BCRYPT_ROUNDS,
  PASSWORD_RESET_TTL_MS,
  hashInvitationToken as hashToken,
  normalizeEmail,
} from '../users/users-helpers';
import { decryptStoredTotpSecret } from './auth-totp-secret';
import { consumeRecoveryCode, serializeRecoveryCodeHashes } from './auth-recovery-codes';

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuthPasswordResetService {
  private readonly logger = new Logger(AuthPasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly sessionService: UsersSessionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Inicia el flujo de password reset. Responde 200 sin distinguir si el
   * email existe o no, para evitar enumeracion. Si el usuario existe y esta
   * activo, genera un token, lo persiste hash y envia el correo.
   */
  async requestReset(rawEmail: string, sessionContext: SessionContext = {}): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, nombre: true, active: true },
    });

    if (!user || !user.active) {
      this.logger.log(`Password reset requested for unknown/inactive email: ${email}`);
      return;
    }

    const now = new Date();
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

    // Invalidar tokens previos no usados del mismo usuario.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: encryptNetMeta(sessionContext.ipAddress),
        userAgent: encryptNetMeta(sessionContext.userAgent),
      },
    });

    const delivery = await this.mailService.sendPasswordResetEmail({
      email: user.email,
      token,
      expiresAt,
      recipientName: user.nombre,
    });

    await this.auditService.log({
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      diff: {
        scope: 'EMAIL_RESET_REQUEST',
        emailSent: delivery.sent,
        ipAddress: sessionContext.ipAddress ?? null,
      },
    });
  }

  /**
   * Valida si un token sigue siendo usable (existe, no expirado, no usado).
   * No revela informacion del usuario.
   */
  async validateToken(token: string): Promise<{ valid: boolean; requires2FA: boolean }> {
    const record = await this.findUsableTokenRecord(token);
    if (!record) {
      return { valid: false, requires2FA: false };
    }

    return { valid: true, requires2FA: record.user.totpEnabled };
  }

  /**
   * Confirma el reset: valida token, marca usado, actualiza password,
   * revoca sesiones. Si el usuario tiene 2FA habilitado, exige totpCode
   * (TOTP o recovery code) valido. Nunca bypassea 2FA.
   */
  async confirmReset(
    token: string,
    newPassword: string,
    totpCode: string | undefined,
    sessionContext: SessionContext = {},
  ): Promise<void> {
    const record = await this.findUsableTokenRecord(token);
    if (!record) {
      throw new UnauthorizedException('El enlace de recuperación es inválido o expiró');
    }

    const user = record.user;
    if (!user.active) {
      throw new UnauthorizedException('Cuenta deshabilitada');
    }

    if (user.totpEnabled) {
      if (!totpCode || !totpCode.trim()) {
        throw new BadRequestException('Se requiere un código 2FA o de recuperación');
      }
      const verified = await this.verifyTotpOrRecovery(user.id, user.totpSecret, user.totpRecoveryCodes, totpCode.trim());
      if (!verified) {
        throw new UnauthorizedException('Código 2FA o de recuperación inválido');
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          refreshTokenVersion: { increment: 1 },
        },
      });
    });

    // Revocar todas las sesiones fuera de la transaccion para no bloquearla
    // (la sesionService usa transacciones propias internas en algunos paths).
    await this.sessionService.revokeAllSessionsForUser(user.id);

    await this.auditService.log({
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      diff: {
        scope: 'EMAIL_RESET',
        totpEnforced: user.totpEnabled,
        ipAddress: sessionContext.ipAddress ?? null,
      },
    });
  }

  private async findUsableTokenRecord(token: string) {
    const trimmed = token?.trim();
    if (!trimmed) return null;
    const tokenHash = hashToken(trimmed);
    const now = new Date();

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            active: true,
            nombre: true,
            totpEnabled: true,
            totpSecret: true,
            totpRecoveryCodes: true,
          },
        },
      },
    });

    if (!record || record.usedAt || record.expiresAt <= now) {
      return null;
    }

    return record;
  }

  private async verifyTotpOrRecovery(
    userId: string,
    storedSecret: string | null,
    storedRecoveryCodes: string | null,
    code: string,
  ): Promise<boolean> {
    if (/^\d{6}$/.test(code) && storedSecret) {
      const secret = decryptStoredTotpSecret(storedSecret, this.configService);
      if (authenticator.verify({ token: code, secret })) {
        return true;
      }
    }

    const remainingHashes = await consumeRecoveryCode(code, storedRecoveryCodes);
    if (remainingHashes !== null) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: serializeRecoveryCodeHashes(remainingHashes) },
      });
      return true;
    }

    return false;
  }

  /**
   * Limpieza de tokens vencidos > 7 dias. Llamado por el ops runner.
   */
  async purgeExpiredTokens(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { usedAt: { not: null, lt: cutoff } },
          { expiresAt: { lt: cutoff } },
        ],
      },
    });
    return result.count;
  }
}
