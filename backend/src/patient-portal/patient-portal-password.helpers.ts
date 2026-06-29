import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { encryptNetMeta } from '../common/utils/field-crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortalRequestPasswordResetDto, PortalResetPasswordDto } from './dto/patient-portal.dto';

const PORTAL_RESET_TTL_MINUTES = 30;

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function requestPatientPortalPasswordReset(params: {
  prisma: PrismaService;
  mail: MailService;
  dto: PortalRequestPasswordResetDto;
  context?: SessionContext;
  buildPortalUrl: (pathname: string) => string;
}) {
  const { prisma, mail, dto, context, buildPortalUrl } = params;
  const account = await prisma.patientPortalAccount.findUnique({ where: { email: dto.email } });
  if (!account?.active) return { message: 'Si el correo está registrado, recibirás instrucciones.' };
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + PORTAL_RESET_TTL_MINUTES * 60 * 1000);
  await prisma.patientPortalPasswordResetToken.create({
    data: {
      accountId: account.id,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: encryptNetMeta(context?.ipAddress?.slice(0, 64)),
      userAgent: encryptNetMeta(context?.userAgent?.slice(0, 255)),
    },
  });
  await mail.sendPatientPortalPasswordReset({
    to: account.email,
    resetUrl: buildPortalUrl(`/portal/login?resetToken=${encodeURIComponent(token)}`),
    expiresAt,
  });
  return { message: 'Si el correo está registrado, recibirás instrucciones.' };
}

export async function resetPatientPortalPassword(params: {
  prisma: PrismaService;
  dto: PortalResetPasswordDto;
}) {
  const { prisma, dto } = params;
  const tokenHash = hashToken(dto.token);
  const token = await prisma.patientPortalPasswordResetToken.findUnique({
    where: { tokenHash },
    include: { account: true },
  });
  if (!token || token.usedAt || token.expiresAt < new Date() || !token.account.active) {
    throw new UnauthorizedException('Token inválido o expirado');
  }
  await prisma.$transaction([
    prisma.patientPortalAccount.update({
      where: { id: token.accountId },
      data: {
        passwordHash: await bcrypt.hash(dto.password, 12),
        refreshTokenVersion: { increment: 1 },
        failedAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.patientPortalPasswordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.patientPortalSession.updateMany({
      where: { accountId: token.accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return { message: 'Contraseña actualizada' };
}
