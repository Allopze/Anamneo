import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import * as fs from 'fs/promises';
import { sanitizeFilename, type AttachmentMetadata } from './attachments-helpers';
import {
  getUploadsRoot,
  resolveStoragePath,
  toStoredStoragePath,
  validateFileContent,
  safeUnlink,
} from './attachments.storage';
import { resolveLinkedOrder } from './attachments.linked-order';
import { getAttachmentFile } from './attachments.file-operations';

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  private assertEncounterAllowsAttachmentMutation(status: string) {
    if (status !== 'EN_PROGRESO') {
      throw new BadRequestException('Solo se pueden modificar adjuntos de atenciones en progreso');
    }
  }

  async create(
    encounterId: string,
    file: Express.Multer.File,
    user: RequestUser,
    metadata?: AttachmentMetadata,
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para adjuntar archivos a esta atención');
    }

    this.assertEncounterAllowsAttachmentMutation(encounter.status);

    const uploadsRoot = getUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));
    const resolvedStoragePath = resolveStoragePath(file.path, uploadsRoot);
    const linkedOrder = await resolveLinkedOrder(this.prisma, encounterId, metadata);

    try {
      await fs.access(resolvedStoragePath);
      const normalizedMime = await validateFileContent(resolvedStoragePath, file.mimetype);

      const attachment = await this.prisma.$transaction(async (tx) => {
        const createdAttachment = await tx.attachment.create({
          data: {
            encounterId,
            filename: file.filename,
            originalName: sanitizeFilename(file.originalname),
            mime: normalizedMime,
            size: file.size,
            storagePath: toStoredStoragePath(resolvedStoragePath, uploadsRoot),
            uploadedById: user.id,
            category: metadata?.category?.trim() || null,
            description: metadata?.description?.trim() || null,
            linkedOrderType: linkedOrder?.linkedOrderType || null,
            linkedOrderId: linkedOrder?.linkedOrderId || null,
            linkedOrderLabel: linkedOrder?.linkedOrderLabel || null,
          },
        });

        await this.auditService.log(
          {
            entityType: 'Attachment',
            entityId: createdAttachment.id,
            userId: user.id,
            action: 'CREATE',
            diff: {
              created: {
                id: createdAttachment.id,
                encounterId: createdAttachment.encounterId,
                uploadedById: createdAttachment.uploadedById,
                originalName: createdAttachment.originalName,
                mime: createdAttachment.mime,
                size: createdAttachment.size,
                category: createdAttachment.category,
                linkedOrderType: createdAttachment.linkedOrderType,
                linkedOrderId: createdAttachment.linkedOrderId,
              },
            },
          },
          tx,
        );

        return createdAttachment;
      });

      return {
        id: attachment.id,
        originalName: attachment.originalName,
        mime: attachment.mime,
        size: attachment.size,
        category: attachment.category,
        description: attachment.description,
        linkedOrderType: attachment.linkedOrderType,
        linkedOrderId: attachment.linkedOrderId,
        linkedOrderLabel: attachment.linkedOrderLabel,
        uploadedAt: attachment.uploadedAt,
      };
    } catch (error) {
      await safeUnlink(resolvedStoragePath);
      throw error;
    }
  }

  async findByEncounter(encounterId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { patient: true },
    });

    if (!encounter || encounter.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Atención no encontrada');
    }

    return this.prisma.attachment.findMany({
      where: { encounterId, deletedAt: null },
      select: {
        id: true,
        originalName: true,
        mime: true,
        size: true,
        category: true,
        description: true,
        linkedOrderType: true,
        linkedOrderId: true,
        linkedOrderLabel: true,
        uploadedAt: true,
        uploadedBy: {
          select: { nombre: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getFile(id: string, user: RequestUser) {
    const uploadsRoot = getUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));
    return getAttachmentFile(this.prisma, uploadsRoot, id, getEffectiveMedicoId(user));
  }

  async remove(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const uploadsRoot = getUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));

    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        encounter: { include: { patient: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (attachment.encounter.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para eliminar este archivo');
    }

    if (attachment.deletedAt) {
      throw new NotFoundException('Archivo no encontrado');
    }

    this.assertEncounterAllowsAttachmentMutation(attachment.encounter.status);

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: user.id },
      });

      await this.auditService.log(
        {
          entityType: 'Attachment',
          entityId: attachment.id,
          userId: user.id,
          action: 'SOFT_DELETE',
          diff: {
            deleted: {
              id: attachment.id,
              encounterId: attachment.encounterId,
              uploadedById: attachment.uploadedById,
              originalName: attachment.originalName,
              mime: attachment.mime,
              size: attachment.size,
              storagePath: attachment.storagePath,
              category: attachment.category,
              linkedOrderType: attachment.linkedOrderType,
              linkedOrderId: attachment.linkedOrderId,
            },
          },
        },
        tx,
      );
    });

    return { message: 'Archivo movido a papelera' };
  }

  async purgeExpiredAttachments(retentionDays: number = 30): Promise<{ purged: number; errors: string[] }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const uploadsRoot = getUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));

    const expired = await this.prisma.attachment.findMany({
      where: {
        deletedAt: { not: null, lte: cutoff },
      },
      select: { id: true, storagePath: true, originalName: true },
    });

    let purged = 0;
    const errors: string[] = [];

    for (const att of expired) {
      try {
        const resolvedPath = resolveStoragePath(att.storagePath, uploadsRoot);
        await safeUnlink(resolvedPath);
        await this.prisma.attachment.delete({ where: { id: att.id } });
        purged++;
      } catch (err) {
        errors.push(`${att.id} (${att.originalName}): ${(err as Error).message}`);
      }
    }

    return { purged, errors };
  }

  async logDownload(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      select: {
        id: true,
        encounterId: true,
        originalName: true,
        mime: true,
        size: true,
      },
    });

    if (!attachment) {
      return;
    }

    await this.auditService.log({
      entityType: 'Attachment',
      entityId: attachment.id,
      userId,
      action: 'DOWNLOAD',
      diff: {
        download: {
          id: attachment.id,
          encounterId: attachment.encounterId,
          originalName: attachment.originalName,
          mime: attachment.mime,
          size: attachment.size,
        },
      },
    });
  }
}
