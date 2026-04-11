import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { parseStoredJson } from '../common/utils/encounter-sections';
import { resolveUploadsRoot } from '../common/utils/uploads-root';
import * as fs from 'fs/promises';
import * as path from 'path';

const SIGNATURE_BYTES_TO_READ = 16;
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
]);
const LINKABLE_ORDER_FIELDS = {
  EXAMEN: 'examenesEstructurados',
  DERIVACION: 'derivacionesEstructuradas',
} as const;

type LinkedOrderType = keyof typeof LINKABLE_ORDER_FIELDS;
type AttachmentMetadata = {
  category?: string;
  description?: string;
  linkedOrderType?: string;
  linkedOrderId?: string;
};

type StructuredOrder = {
  id?: string;
  nombre?: string;
};

function sanitizeFilename(name: string): string {
  const baseName = path.basename(name || '').replace(/[\r\n"]/g, '_').trim();
  return baseName || 'adjunto';
}

function normalizeMimeType(mime: string): string {
  if (mime === 'image/jpg' || mime === 'image/pjpeg') {
    return 'image/jpeg';
  }

  return (mime || '').toLowerCase();
}

function detectMimeFromSignature(header: Buffer): string | null {
  if (header.length >= 5 && header.subarray(0, 5).toString('utf8') === '%PDF-') {
    return 'application/pdf';
  }

  if (
    header.length >= 3
    && header[0] === 0xff
    && header[1] === 0xd8
    && header[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    header.length >= 8
    && header[0] === 0x89
    && header[1] === 0x50
    && header[2] === 0x4e
    && header[3] === 0x47
    && header[4] === 0x0d
    && header[5] === 0x0a
    && header[6] === 0x1a
    && header[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (header.length >= 6) {
    const gifHeader = header.subarray(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return 'image/gif';
    }
  }

  return null;
}

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

      const attachment = await this.prisma.attachment.create({
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

      await this.auditService.log({
        entityType: 'Attachment',
        entityId: attachment.id,
        userId: user.id,
        action: 'CREATE',
        diff: {
          created: {
            id: attachment.id,
            encounterId: attachment.encounterId,
            uploadedById: attachment.uploadedById,
            originalName: attachment.originalName,
            mime: attachment.mime,
            size: attachment.size,
            category: attachment.category,
            linkedOrderType: attachment.linkedOrderType,
            linkedOrderId: attachment.linkedOrderId,
          },
        },
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
      where: { encounterId },
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

    if (!attachment) {
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

    const resolvedPath = this.resolveStoragePath(attachment.storagePath);

    // Delete physical file
    await this.safeUnlink(resolvedPath);

    await this.prisma.attachment.delete({ where: { id } });

    await this.auditService.log({
      entityType: 'Attachment',
      entityId: attachment.id,
      userId: user.id,
      action: 'DELETE',
      diff: {
        deleted: {
          id: attachment.id,
          encounterId: attachment.encounterId,
          uploadedById: attachment.uploadedById,
          originalName: attachment.originalName,
          mime: attachment.mime,
          size: attachment.size,
          category: attachment.category,
          linkedOrderType: attachment.linkedOrderType,
          linkedOrderId: attachment.linkedOrderId,
        },
      },
    });

    return { message: 'Archivo eliminado correctamente' };
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
