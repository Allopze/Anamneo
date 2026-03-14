import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  async create(createUserDto: CreateUserDto & { isAdmin?: boolean }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, BCRYPT_ROUNDS);

    const role = (createUserDto.role ?? 'ASISTENTE') as string;
    const isAdmin = role === 'ADMIN' ? true : (createUserDto.isAdmin ?? false);

    if (role === 'ADMIN' && createUserDto.medicoId) {
      throw new ConflictException('Un administrador no puede tener medicoId asignado');
    }

    if (role === 'ASISTENTE' && !createUserDto.medicoId && !isAdmin) {
      throw new ConflictException('Un asistente debe estar asignado a un médico');
    }

    if (role === 'MEDICO' && createUserDto.medicoId) {
      throw new ConflictException('Un médico no puede tener medicoId asignado');
    }

    if (createUserDto.medicoId) {
      const medico = await this.prisma.user.findUnique({ where: { id: createUserDto.medicoId } });
      if (!medico || medico.role !== 'MEDICO') {
        throw new NotFoundException('Médico asignado no encontrado');
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
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
      if (!medico || medico.role !== 'MEDICO') {
        throw new NotFoundException('Médico asignado no encontrado');
      }
    }

    return this.prisma.user.update({
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
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.assertNotLeavingSystemWithoutAdmin(user, { active: false });

    // Soft delete - just deactivate
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        email: true,
        active: true,
      },
    });
  }

  async updateProfile(id: string, data: { nombre?: string; email?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.email !== undefined && { email: data.email }),
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
      data: { passwordHash },
    });
  }

  async resetPassword(id: string, temporaryPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalizedPassword = temporaryPassword.trim();
    if (normalizedPassword.length < 8) {
      throw new ConflictException('La contraseña temporal debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(normalizedPassword) || !/[a-z]/.test(normalizedPassword) || !/[0-9]/.test(normalizedPassword)) {
      throw new ConflictException('La contraseña temporal debe contener mayúscula, minúscula y número');
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Contraseña restablecida correctamente' };
  }
}
