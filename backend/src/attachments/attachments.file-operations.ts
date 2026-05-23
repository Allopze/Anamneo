import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeFilename } from './attachments-helpers';
import { resolveStoragePath } from './attachments.storage';
import { decryptBuffer, isEncryptionEnvelope } from '../common/utils/field-crypto';

export interface AttachmentFile {
  filename: string;
  mime: string;
  /** Plaintext path on disk. Set when the file is NOT encrypted at app-level. */
  path?: string;
  /** Decrypted buffer in memory. Set when the file IS encrypted at app-level. */
  buffer?: Buffer;
}

export async function getAttachmentFile(
  prisma: PrismaService,
  uploadsRoot: string,
  id: string,
  effectiveMedicoId: string,
): Promise<AttachmentFile> {
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
  const filename = sanitizeFilename(attachment.originalName);

  // Ley 21.719 Art 14 quinquies: si el archivo esta cifrado a nivel app,
  // lo descifrarmos en memoria y devolvemos buffer en vez de path.
  if (attachment.encryptionEnvelope && isEncryptionEnvelope(attachment.encryptionEnvelope)) {
    const ciphertext = await fs.readFile(resolvedPath);
    const plain = decryptBuffer(ciphertext, attachment.encryptionEnvelope);
    return { filename, mime: attachment.mime, buffer: plain };
  }

  return { path: resolvedPath, filename, mime: attachment.mime };
}
