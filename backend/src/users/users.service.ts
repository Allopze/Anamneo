import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import {
  BCRYPT_ROUNDS,
  normalizeEmail,
  validateTemporaryPassword,
} from './users-helpers';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async assertNotLeavingSystemWithoutAdmin(user: {
    id: string;
    isAdmin: boolean;
    active: boolean;
  }, changes: { active?: boolean; role?: string }) {
    const willLoseAdminAccess = user.isAdmin
      && user.active
      && (changes.active === false || (changes.role !== undefined && changes.role !== 'ADMIN'));

    if (!willLoseAdminAccess) {
      return;
    }

    const remainingActiveAdmins = await this.prisma.user.count({
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

  async countUsers() {
    return this.prisma.user.count();
  }

  async countActiveAdmins() {
    return this.prisma.user.count({
      where: {
        isAdmin: true,
        active: true,
      },
    });
  }

  async create(createUserDto: CreateUserDto & { isAdmin?: boolean; allowUnassignedAssistant?: boolean }) {
    const existingUser = await this.prisma.user.findUnique({
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
      const medico = await this.prisma.user.findUnique({ where: { id: createUserDto.medicoId } });
      if (!medico || medico.role !== 'MEDICO' || !medico.active) {
        throw new NotFoundException('Médico asignado no encontrado');
      }
    }

    const user = await this.prisma.user.create({
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

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        medicoId: true,
        isAdmin: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        medicoId: true,
        isAdmin: true,
        active: true,
        mustChangePassword: true,
        totpEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const data: any = { ...updateUserDto };

    if (updateUserDto.password) {
      data.passwordHash = await bcrypt.hash(updateUserDto.password, BCRYPT_ROUNDS);
      delete data.password;
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
    }

    const nextRole = (updateUserDto.role ?? user.role) as string;
    await this.assertNotLeavingSystemWithoutAdmin(user, {
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
      const medico = await this.prisma.user.findUnique({ where: { id: nextMedicoId } });
      if (!medico || medico.role !== 'MEDICO' || !medico.active) {
        throw new NotFoundException('Médico asignado no encontrado');
      }
    }

    const updated = await this.prisma.user.update({
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

    await this.auditService.log({
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

  async remove(id: string, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.assertNotLeavingSystemWithoutAdmin(user, { active: false });

    // Soft delete - just deactivate
    const removed = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        email: true,
        active: true,
      },
    });

    await this.auditService.log({
      entityType: 'User',
      entityId: removed.id,
      userId: actorUserId,
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

  async updateProfile(id: string, data: { nombre?: string; email?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalizedEmail = data.email?.trim().toLowerCase();

    if (normalizedEmail && normalizedEmail !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
    }

    const updated = await this.prisma.user.update({
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

    await this.auditService.log({
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

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new ConflictException('La contraseña actual es incorrecta');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: false },
    });

    await this.auditService.log({
      entityType: 'User',
      entityId: user.id,
      userId: id,
      action: 'PASSWORD_CHANGED',
      diff: {
        selfService: true,
      },
    });
  }

  async resetPassword(id: string, temporaryPassword: string, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalizedPassword = temporaryPassword.trim();
    const passwordError = validateTemporaryPassword(temporaryPassword);
    if (passwordError) {
      throw new ConflictException(passwordError);
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.auditService.log({
      entityType: 'User',
      entityId: user.id,
      userId: actorUserId,
      action: 'PASSWORD_CHANGED',
      diff: {
        reset: {
          id: user.id,
          email: user.email,
          temporary: true,
        },
      },
    });

    return { message: 'Contraseña restablecida correctamente' };
  }
}
