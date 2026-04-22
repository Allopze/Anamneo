import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersSessionService } from './users-session.service';
import {
  createUser,
  updateUser,
  removeUser,
  updateUserProfile,
  changeUserPassword,
  resetUserPassword,
} from './users-service.helpers';
import { normalizeEmail } from './users-helpers';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly usersSessionService: UsersSessionService,
  ) {}

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
    return createUser(this.prisma, this.auditService, createUserDto);
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
    return this.prisma.user.findUnique({
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
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, actorUserId: string) {
    return updateUser(
      this.prisma,
      this.auditService,
      this.usersSessionService,
      id,
      updateUserDto,
      actorUserId,
    );
  }

  async remove(id: string, actorUserId: string) {
    return removeUser(this.prisma, this.auditService, id);
  }

  async updateProfile(id: string, data: { nombre?: string; email?: string }) {
    return updateUserProfile(this.prisma, this.auditService, id, data);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    return changeUserPassword(this.prisma, this.auditService, id, currentPassword, newPassword);
  }

  async resetPassword(id: string, temporaryPassword: string, actorUserId: string) {
    return resetUserPassword(
      this.prisma,
      this.auditService,
      this.usersSessionService,
      id,
      temporaryPassword,
      actorUserId,
    );
  }
}
