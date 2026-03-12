import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import * as fs from 'fs/promises';

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async create(
    encounterId: string,
    file: Express.Multer.File,
    user: RequestUser,
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    // Verify encounter exists
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.patient.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para adjuntar archivos a esta atención');
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        encounterId,
        filename: file.filename,
        originalName: file.originalname,
        mime: file.mimetype,
        size: file.size,
        storagePath: file.path,
        uploadedById: user.id,
      },
    });

    return {
      id: attachment.id,
      filename: attachment.originalName,
      mime: attachment.mime,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt,
    };
  }

  async findByEncounter(encounterId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { patient: true },
    });

    if (!encounter || encounter.patient.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Atención no encontrada');
    }

    return this.prisma.attachment.findMany({
      where: { encounterId },
      select: {
        id: true,
        originalName: true,
        mime: true,
        size: true,
        uploadedAt: true,
        uploadedBy: {
          select: { nombre: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getFile(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        encounter: { include: { patient: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (attachment.encounter.patient.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Archivo no encontrado');
    }

    return {
      path: attachment.storagePath,
      filename: attachment.originalName,
      mime: attachment.mime,
    };
  }

  async remove(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        encounter: { include: { patient: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (attachment.encounter.patient.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para eliminar este archivo');
    }

    // Delete physical file
    try {
      await fs.unlink(attachment.storagePath);
    } catch (error) {
      // File might already be deleted, continue
    }

    await this.prisma.attachment.delete({ where: { id } });

    return { message: 'Archivo eliminado correctamente' };
  }
}
