import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { parseStoredJson } from '../common/utils/encounter-sections';
import { resolveUploadsRoot } from '../common/utils/uploads-root';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SIGNATURE_BYTES_TO_READ,
  SUPPORTED_MIME_TYPES,
  LINKABLE_ORDER_FIELDS,
  sanitizeFilename,
  normalizeMimeType,
  detectMimeFromSignature,
  type LinkedOrderType,
  type AttachmentMetadata,
  type StructuredOrder,
} from './attachments-helpers';

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  private getUploadsRoot(): string {
    return resolveUploadsRoot(this.configService.get<string>('UPLOAD_DEST'));
  }

  private resolveStoragePath(storagePath: string): string {
    const uploadsRoot = this.getUploadsRoot();
    const absolutePath = path.isAbsolute(storagePath)
      ? path.normalize(storagePath)
      : path.resolve(uploadsRoot, storagePath);
    const relativeToRoot = path.relative(uploadsRoot, absolutePath);

    if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    return absolutePath;
  }

  private toStoredStoragePath(absolutePath: string): string {
    const relativePath = path.relative(this.getUploadsRoot(), absolutePath);
    return relativePath.replace(/\\/g, '/');
  }

  private async readFileSignature(filePath: string): Promise<Buffer> {
    const fileHandle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(SIGNATURE_BYTES_TO_READ);
      const { bytesRead } = await fileHandle.read(buffer, 0, SIGNATURE_BYTES_TO_READ, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await fileHandle.close();
    }
  }

  private async validateFileContent(filePath: string, declaredMime: string): Promise<string> {
    const normalizedDeclaredMime = normalizeMimeType(declaredMime);
    const header = await this.readFileSignature(filePath);
    const detectedMime = detectMimeFromSignature(header);

    if (!detectedMime || !SUPPORTED_MIME_TYPES.has(detectedMime)) {
      throw new BadRequestException('El contenido del archivo no corresponde a un tipo permitido');
    }

    if (normalizedDeclaredMime !== 'application/octet-stream' && normalizedDeclaredMime !== detectedMime) {
      throw new BadRequestException('El tipo de archivo declarado no coincide con su contenido');
    }

    return detectedMime;
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup failures.
    }
  }

  private async resolveLinkedOrder(
    encounterId: string,
    metadata?: AttachmentMetadata,
  ): Promise<{ linkedOrderType: LinkedOrderType; linkedOrderId: string; linkedOrderLabel: string } | null> {
    const linkedOrderId = metadata?.linkedOrderId?.trim();
    const linkedOrderTypeRaw = metadata?.linkedOrderType?.trim().toUpperCase();

    if (!linkedOrderId && !linkedOrderTypeRaw) {
      return null;
    }

    if (!linkedOrderId || !linkedOrderTypeRaw) {
      throw new BadRequestException('Debe indicar el tipo y el identificador del item vinculado');
    }

    if (!(linkedOrderTypeRaw in LINKABLE_ORDER_FIELDS)) {
      throw new BadRequestException('El tipo de item vinculado no es valido');
    }

    const treatmentSection = await this.prisma.encounterSection.findUnique({
      where: {
        encounterId_sectionKey: {
          encounterId,
          sectionKey: 'TRATAMIENTO',
        },
      },
      select: {
        data: true,
      },
    });

    const treatmentData = parseStoredJson<Record<string, StructuredOrder[]>>(treatmentSection?.data, {});
    const orderField = LINKABLE_ORDER_FIELDS[linkedOrderTypeRaw as LinkedOrderType];
    const order = (Array.isArray(treatmentData[orderField]) ? treatmentData[orderField] : []).find(
      (item) => item?.id === linkedOrderId,
    );

    if (!order) {
      throw new BadRequestException('No se encontro el examen o derivacion estructurada seleccionada');
    }

    return {
      linkedOrderType: linkedOrderTypeRaw as LinkedOrderType,
      linkedOrderId,
      linkedOrderLabel: order.nombre?.trim() || linkedOrderId,
    };
  }

  async create(
    encounterId: string,
    file: Express.Multer.File,
    user: RequestUser,
    metadata?: AttachmentMetadata,
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

    if (encounter.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para adjuntar archivos a esta atención');
    }

    const resolvedStoragePath = this.resolveStoragePath(file.path);
    const linkedOrder = await this.resolveLinkedOrder(encounterId, metadata);

    try {
      await fs.access(resolvedStoragePath);
      const normalizedMime = await this.validateFileContent(resolvedStoragePath, file.mimetype);

      const attachment = await this.prisma.$transaction(async (tx) => {
        const createdAttachment = await tx.attachment.create({
          data: {
            encounterId,
            filename: file.filename,
            originalName: sanitizeFilename(file.originalname),
            mime: normalizedMime,
            size: file.size,
            storagePath: this.toStoredStoragePath(resolvedStoragePath),
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
      await this.safeUnlink(resolvedStoragePath);
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
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        encounter: { include: { patient: true } },
      },
    });

    if (!attachment || attachment.deletedAt) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (attachment.encounter.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const resolvedPath = this.resolveStoragePath(attachment.storagePath);
    await fs.access(resolvedPath);

    return {
      path: resolvedPath,
      filename: sanitizeFilename(attachment.originalName),
      mime: attachment.mime,
    };
  }

  async remove(id: string, user: RequestUser) {
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

    if (attachment.encounter.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para eliminar este archivo');
    }

    if (attachment.deletedAt) {
      throw new NotFoundException('Archivo no encontrado');
    }

    // Soft-delete: mark as deleted, keep the physical file for retention period
    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: user.id },
      });

      await this.auditService.log({
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
      }, tx);
    });

    return { message: 'Archivo movido a papelera' };
  }

  async purgeExpiredAttachments(retentionDays: number = 30): Promise<{ purged: number; errors: string[] }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

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
        const resolvedPath = this.resolveStoragePath(att.storagePath);
        await this.safeUnlink(resolvedPath);
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
