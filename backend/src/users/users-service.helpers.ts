import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersSessionService } from './users-session.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_ROUNDS,
  normalizeEmail,
} from './users-helpers';

export async function revokeUserSessions(
  usersSessionService: UsersSessionService,
  userId: string,
) {
  await usersSessionService.rotateRefreshTokenVersion(userId);
  await usersSessionService.revokeAllSessionsForUser(userId);
}

export async function assertNotLeavingSystemWithoutAdmin(
  prisma: PrismaService,
  user: {
    id: string;
    isAdmin: boolean;
    active: boolean;
  },
  changes: { active?: boolean; role?: string },
) {
  const willLoseAdminAccess = user.isAdmin
    && user.active
    && (changes.active === false || (changes.role !== undefined && changes.role !== 'ADMIN'));

  if (!willLoseAdminAccess) {
    return;
  }

  const remainingActiveAdmins = await prisma.user.count({
    where: {
      isAdmin: true,
      active: true,
      NOT: { id: user.id },
    },
  });

  if (remainingActiveAdmins === 0) {
    throw new ConflictException('Debe existir al menos un administrador activo en el sistema');
  }
}

export async function createUser(
  prisma: PrismaService,
  auditService: AuditService,
  createUserDto: CreateUserDto & { isAdmin?: boolean; allowUnassignedAssistant?: boolean },
) {
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizeEmail(createUserDto.email) },
  });

  if (existingUser) {
    throw new ConflictException('El correo electrónico ya está registrado');
  }

  const passwordHash = await bcrypt.hash(createUserDto.password, BCRYPT_ROUNDS);

  const role = (createUserDto.role ?? 'ASISTENTE') as string;
  const isAdmin = role === 'ADMIN' ? true : (createUserDto.isAdmin ?? false);
  const allowUnassignedAssistant = !!createUserDto.allowUnassignedAssistant;

  if (role === 'ADMIN' && createUserDto.medicoId) {
    throw new ConflictException('Un administrador no puede tener medicoId asignado');
  }

  if (role === 'ASISTENTE' && !createUserDto.medicoId && !isAdmin && !allowUnassignedAssistant) {
    throw new ConflictException('Un asistente debe estar asignado a un médico');
  }

  if (role === 'MEDICO' && createUserDto.medicoId) {
    throw new ConflictException('Un médico no puede tener medicoId asignado');
  }

  if (createUserDto.medicoId) {
    const medico = await prisma.user.findUnique({ where: { id: createUserDto.medicoId } });
    if (!medico || medico.role !== 'MEDICO' || !medico.active) {
      throw new NotFoundException('Médico asignado no encontrado');
    }
  }

  const user = await prisma.user.create({
    data: {
      email: normalizeEmail(createUserDto.email),
      passwordHash,
      nombre: createUserDto.nombre,
      role,
      medicoId: createUserDto.medicoId ?? null,
      isAdmin,
    },
    select: {
      id: true,
      email: true,
      nombre: true,
      role: true,
      medicoId: true,
      isAdmin: true,
      active: true,
      refreshTokenVersion: true,
      createdAt: true,
    },
  });

  return user;
}

export async function updateUser(
  prisma: PrismaService,
  auditService: AuditService,
  usersSessionService: UsersSessionService,
  id: string,
  updateUserDto: UpdateUserDto,
  actorUserId: string,
) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  const data: any = { ...updateUserDto };

  if (updateUserDto.password) {
    data.passwordHash = await bcrypt.hash(updateUserDto.password, BCRYPT_ROUNDS);
    delete data.password;
  }

  if (updateUserDto.email && updateUserDto.email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: updateUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }
  }

  const nextRole = (updateUserDto.role ?? user.role) as string;
  await assertNotLeavingSystemWithoutAdmin(prisma, user, {
    active: updateUserDto.active,
    role: nextRole,
  });

  if (nextRole === 'ADMIN') {
    data.isAdmin = true;
    data.medicoId = null;
  } else {
    data.isAdmin = false;
    if (nextRole === 'MEDICO') {
      data.medicoId = null;
    }
  }

  const nextMedicoId = data.medicoId !== undefined ? data.medicoId : user.medicoId;

  if (nextRole === 'ADMIN' && nextMedicoId) {
    throw new ConflictException('Un administrador no puede tener medicoId asignado');
  }

  if (nextRole === 'ASISTENTE' && !nextMedicoId) {
    throw new ConflictException('Un asistente debe estar asignado a un médico');
  }

  if (nextRole === 'MEDICO' && nextMedicoId) {
    throw new ConflictException('Un médico no puede tener medicoId asignado');
  }

  if (nextMedicoId) {
    const medico = await prisma.user.findUnique({ where: { id: nextMedicoId } });
    if (!medico || medico.role !== 'MEDICO' || !medico.active) {
      throw new NotFoundException('Médico asignado no encontrado');
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      nombre: true,
      role: true,
      medicoId: true,
      isAdmin: true,
      active: true,
      updatedAt: true,
    },
  });

  if (updateUserDto.password) {
    await revokeUserSessions(usersSessionService, updated.id);
  }

  await auditService.log({
    entityType: 'User',
    entityId: updated.id,
    userId: actorUserId,
    action: 'UPDATE',
    diff: {
      before: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        medicoId: user.medicoId,
        isAdmin: user.isAdmin,
        active: user.active,
      },
      after: updated,
    },
  });

  return updated;
}

export { removeUser } from './users-lifecycle.helpers';

export async function updateUserProfile(
  prisma: PrismaService,
  auditService: AuditService,
  id: string,
  data: { nombre?: string; email?: string },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundException('Usuario no encontrado');
  }

  const normalizedEmail = data.email?.trim().toLowerCase();

  if (normalizedEmail && normalizedEmail !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(normalizedEmail !== undefined && { email: normalizedEmail }),
    },
    select: {
      id: true,
      email: true,
      nombre: true,
      role: true,
      medicoId: true,
      isAdmin: true,
    },
  });

  await auditService.log({
    entityType: 'User',
    entityId: updated.id,
    userId: id,
    action: 'UPDATE',
    diff: {
      profile: {
        before: {
          nombre: user.nombre,
          email: user.email,
        },
        after: {
          nombre: updated.nombre,
          email: updated.email,
        },
      },
    },
  });

  return updated;
}

export { changeUserPassword, resetUserPassword } from './users-password.helpers';
