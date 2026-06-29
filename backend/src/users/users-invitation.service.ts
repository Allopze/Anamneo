import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { INVITATION_TTL_MS, normalizeEmail, hashInvitationToken } from './users-helpers';

@Injectable()
export class UsersInvitationService {
  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async createInvitation(invitedById: string, dto: CreateUserInvitationDto) {
    const email = normalizeEmail(dto.email);
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
    const tokenHash = hashInvitationToken(token);
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
        tokenHash: hashInvitationToken(token),
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
}
