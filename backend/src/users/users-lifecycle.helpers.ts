import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertNotLeavingSystemWithoutAdmin } from './users-service.helpers';

export async function removeUser(
  prisma: PrismaService,
  auditService: AuditService,
  id: string,
) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  await assertNotLeavingSystemWithoutAdmin(prisma, user, { active: false });

  const removed = await prisma.user.update({
    where: { id },
    data: { active: false },
    select: {
      id: true,
      email: true,
      active: true,
    },
  });

  await auditService.log({
    entityType: 'User',
    entityId: removed.id,
    userId: id,
    action: 'UPDATE',
    diff: {
      deactivated: {
        id: removed.id,
        email: removed.email,
        active: removed.active,
      },
    },
  });

  return removed;
}
