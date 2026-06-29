import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS, validateTemporaryPassword } from './users-helpers';
import { UsersSessionService } from './users-session.service';

export async function changeUserPassword(
  prisma: PrismaService,
  auditService: AuditService,
  id: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new ConflictException('La contraseña actual es incorrecta');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: false },
  });

  await auditService.log({
    entityType: 'User',
    entityId: user.id,
    userId: id,
    action: 'PASSWORD_CHANGED',
    diff: {
      selfService: true,
    },
  });
}

export async function resetUserPassword(
  prisma: PrismaService,
  auditService: AuditService,
  usersSessionService: UsersSessionService,
  id: string,
  temporaryPassword: string,
  actorUserId: string,
) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  const normalizedPassword = temporaryPassword.trim();
  const passwordError = validateTemporaryPassword(temporaryPassword);
  if (passwordError) {
    throw new ConflictException(passwordError);
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, BCRYPT_ROUNDS);
  const hadTotpEnrollment = !!user.totpEnabled || !!user.totpSecret || !!user.totpRecoveryCodes;
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryCodes: null,
    },
  });
  await usersSessionService.rotateRefreshTokenVersion(id);
  await usersSessionService.revokeAllSessionsForUser(id);

  await auditService.log({
    entityType: 'User',
    entityId: user.id,
    userId: actorUserId,
    action: 'PASSWORD_CHANGED',
    diff: {
      reset: {
        id: user.id,
        email: user.email,
        temporary: true,
        totpEnrollmentReset: hadTotpEnrollment,
      },
    },
  });

  return { message: 'Contraseña restablecida correctamente' };
}
