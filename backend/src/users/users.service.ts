import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

const BCRYPT_ROUNDS = 12;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionMetadata = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hashInvitationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

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
      where: { email: this.normalizeEmail(createUserDto.email) },
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
        email: this.normalizeEmail(createUserDto.email),
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
      where: { email: this.normalizeEmail(email) },
    });
  }

  async createInvitation(invitedById: string, dto: CreateUserInvitationDto) {
    const email = this.normalizeEmail(dto.email);
    let assignedMedicoName: string | null = null;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    if (dto.role === 'ASISTENTE' && !dto.medicoId) {
      throw new ConflictException('Un asistente invitado debe estar asignado a un médico');
    }

    if ((dto.role === 'MEDICO' || dto.role === 'ADMIN') && dto.medicoId) {
      throw new ConflictException(`Un ${dto.role === 'ADMIN' ? 'administrador' : 'médico'} invitado no puede tener medicoId asignado`);
    }

    if (dto.medicoId) {
      const medico = await this.prisma.user.findUnique({
        where: { id: dto.medicoId },
        select: { id: true, role: true, active: true, nombre: true },
      });

      if (!medico || medico.role !== 'MEDICO' || !medico.active) {
        throw new NotFoundException('Médico asignado no encontrado');
      }

      assignedMedicoName = medico.nombre;
    }

    const now = new Date();
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashInvitationToken(token);
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

    await this.prisma.userInvitation.updateMany({
      where: {
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    const invitation = await this.prisma.userInvitation.create({
      data: {
        email,
        role: dto.role,
        medicoId: dto.role === 'ASISTENTE' ? dto.medicoId ?? null : null,
        tokenHash,
        invitedById,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        medicoId: true,
        expiresAt: true,
      },
    });

    const delivery = await this.mailService.sendInvitationEmail({
      email,
      role: dto.role,
      token,
      expiresAt,
      assignedMedicoName,
    });

    await this.auditService.log({
      entityType: 'UserInvitation',
      entityId: invitation.id,
      userId: invitedById,
      action: 'CREATE',
      diff: {
        created: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          medicoId: invitation.medicoId,
          expiresAt: invitation.expiresAt,
          emailSent: delivery.sent,
        },
      },
    });

    return {
      ...invitation,
      token,
      inviteUrl: delivery.inviteUrl,
      emailSent: delivery.sent,
      emailError: delivery.reason,
    };
  }

  async findInvitationByToken(token: string) {
    const now = new Date();

    return this.prisma.userInvitation.findFirst({
      where: {
        tokenHash: this.hashInvitationToken(token),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        email: true,
        role: true,
        medicoId: true,
        invitedById: true,
        expiresAt: true,
      },
    });
  }

  async acceptInvitation(id: string) {
    await this.prisma.userInvitation.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });
  }

  async listInvitations() {
    return this.prisma.userInvitation.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        medicoId: true,
        invitedById: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(id: string, actorUserId: string) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id },
      select: {
        id: true,
        acceptedAt: true,
        revokedAt: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.acceptedAt || invitation.revokedAt) {
      throw new ConflictException('La invitación ya no está activa');
    }

    const revoked = await this.prisma.userInvitation.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        email: true,
        role: true,
        medicoId: true,
        revokedAt: true,
      },
    });

    await this.auditService.log({
      entityType: 'UserInvitation',
      entityId: revoked.id,
      userId: actorUserId,
      action: 'UPDATE',
      diff: {
        revoked: {
          id: revoked.id,
          email: revoked.email,
          role: revoked.role,
          medicoId: revoked.medicoId,
          revokedAt: revoked.revokedAt,
        },
      },
    });

    return revoked;
  }

  async findAuthById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        refreshTokenVersion: true,
      },
    });
  }

  async rotateRefreshTokenVersion(id: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        refreshTokenVersion: {
          increment: 1,
        },
      },
      select: {
        refreshTokenVersion: true,
      },
    });

    return updated.refreshTokenVersion;
  }

  private normalizeSessionMetadata(metadata?: SessionMetadata) {
    const userAgent = metadata?.userAgent?.trim().slice(0, 255) || null;
    const ipAddress = metadata?.ipAddress?.trim().slice(0, 64) || null;

    return {
      userAgent,
      ipAddress,
    };
  }

  async createSession(userId: string, metadata?: SessionMetadata) {
    const normalized = this.normalizeSessionMetadata(metadata);

    return this.prisma.userSession.create({
      data: {
        userId,
        tokenVersion: 1,
        userAgent: normalized.userAgent,
        ipAddress: normalized.ipAddress,
        lastUsedAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        tokenVersion: true,
        userAgent: true,
        ipAddress: true,
        revokedAt: true,
      },
    });
  }

  async findActiveSessionById(id: string) {
    return this.prisma.userSession.findFirst({
      where: {
        id,
        revokedAt: null,
      },
      select: {
        id: true,
        userId: true,
        tokenVersion: true,
        userAgent: true,
        ipAddress: true,
        revokedAt: true,
      },
    });
  }

  async rotateSessionTokenVersion(id: string, metadata?: SessionMetadata) {
    const normalized = this.normalizeSessionMetadata(metadata);

    const updated = await this.prisma.userSession.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        tokenVersion: {
          increment: 1,
        },
        lastUsedAt: new Date(),
        ...(normalized.userAgent !== null ? { userAgent: normalized.userAgent } : {}),
        ...(normalized.ipAddress !== null ? { ipAddress: normalized.ipAddress } : {}),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.prisma.userSession.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        tokenVersion: true,
        userAgent: true,
        ipAddress: true,
        revokedAt: true,
      },
    });
  }

  async revokeSessionById(id: string) {
    await this.prisma.userSession.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllSessionsForUser(userId: string) {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
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
    if (normalizedPassword.length < 8) {
      throw new ConflictException('La contraseña temporal debe tener al menos 8 caracteres');
    }
    if (/\s/.test(normalizedPassword)) {
      throw new ConflictException('La contraseña temporal no puede contener espacios');
    }
    if (!/[A-Z]/.test(normalizedPassword) || !/[a-z]/.test(normalizedPassword) || !/[0-9]/.test(normalizedPassword)) {
      throw new ConflictException('La contraseña temporal debe contener mayúscula, minúscula y número');
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
