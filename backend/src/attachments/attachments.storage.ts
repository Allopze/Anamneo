import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveUploadsRoot } from '../common/utils/uploads-root';
import {
  SIGNATURE_BYTES_TO_READ,
  SUPPORTED_MIME_TYPES,
  normalizeMimeType,
  detectMimeFromSignature,
} from './attachments-helpers';

export function getUploadsRoot(uploadDest: string | undefined) {
  return resolveUploadsRoot(uploadDest);
}

export function resolveStoragePath(storagePath: string, uploadsRoot: string) {
  const absolutePath = path.isAbsolute(storagePath)
    ? path.normalize(storagePath)
    : path.resolve(uploadsRoot, storagePath);
  const relativeToRoot = path.relative(uploadsRoot, absolutePath);

  if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new NotFoundException('Archivo no encontrado');
  }

  return absolutePath;
}

export function toStoredStoragePath(absolutePath: string, uploadsRoot: string) {
  const relativePath = path.relative(uploadsRoot, absolutePath);
  return relativePath.replace(/\\/g, '/');
}

export async function readFileSignature(filePath: string): Promise<Buffer> {
  const fileHandle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(SIGNATURE_BYTES_TO_READ);
    const { bytesRead } = await fileHandle.read(buffer, 0, SIGNATURE_BYTES_TO_READ, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fileHandle.close();
  }
}

export async function validateFileContent(filePath: string, declaredMime: string): Promise<string> {
  const normalizedDeclaredMime = normalizeMimeType(declaredMime);
  const header = await readFileSignature(filePath);
  const detectedMime = detectMimeFromSignature(header);

  if (!detectedMime || !SUPPORTED_MIME_TYPES.has(detectedMime)) {
    throw new BadRequestException('El contenido del archivo no corresponde a un tipo permitido');
  }

  if (normalizedDeclaredMime !== 'application/octet-stream' && normalizedDeclaredMime !== detectedMime) {
    throw new BadRequestException('El tipo de archivo declarado no coincide con su contenido');
  }

  return detectedMime;
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup failures.
  }
}
