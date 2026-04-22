import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeFilename } from './attachments-helpers';
import { resolveStoragePath } from './attachments.storage';

export async function getAttachmentFile(
  prisma: PrismaService,
  uploadsRoot: string,
  id: string,
  effectiveMedicoId: string,
) {
  const attachment = await prisma.attachment.findUnique({
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

  const resolvedPath = resolveStoragePath(attachment.storagePath, uploadsRoot);

  return {
    path: resolvedPath,
    filename: sanitizeFilename(attachment.originalName),
    mime: attachment.mime,
  };
}
