import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEGAL_DOCUMENT_SELECT_SQL,
  findLegalDocumentByIdRaw,
  formatDocument,
  normalizeLegalDocumentRow,
  supportsRawQueries,
  type LegalAdminUser,
  type LegalDocumentRecord,
  type LegalDocumentRow,
} from './legal-service-helpers';

export async function publishLegalDocumentDraft(
  prisma: PrismaService,
  user: LegalAdminUser,
  id: string,
) {
  if (supportsRawQueries(prisma)) {
    const document = await findLegalDocumentByIdRaw(prisma, id);

    if (!document) {
      throw new NotFoundException('No se encontró el documento legal');
    }
    if (document.status !== 'DRAFT') {
      throw new BadRequestException('Solo un borrador puede publicarse');
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'UPDATE legal_documents SET status = $1, updated_by_id = $2, updated_at = CURRENT_TIMESTAMP WHERE type = $3 AND status = $4',
        'ARCHIVED',
        user.id,
        document.type,
        'PUBLISHED',
      );

      await tx.$executeRawUnsafe(
        'UPDATE legal_documents SET status = $1, published_at = $2, updated_by_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        'PUBLISHED',
        now,
        user.id,
        id,
      );

      const [updatedDocument] = await tx.$queryRawUnsafe<LegalDocumentRecord[]>(
        `${LEGAL_DOCUMENT_SELECT_SQL} WHERE id = $1 LIMIT 1`,
        id,
      );

      return updatedDocument;
    });

    if (!updated) {
      throw new Error('No se pudo publicar el borrador legal');
    }

    return formatDocument(updated);
  }

  const typedPrisma = prisma as any;
  const document = await typedPrisma.legalDocument.findUnique({ where: { id } });

  if (!document) {
    throw new NotFoundException('No se encontró el documento legal');
  }
  if (document.status !== 'DRAFT') {
    throw new BadRequestException('Solo un borrador puede publicarse');
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.legalDocument.updateMany({
      where: {
        type: document.type,
        status: 'PUBLISHED',
      },
      data: {
        status: 'ARCHIVED',
        updatedById: user.id,
      },
    });

    return tx.legalDocument.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        updatedById: user.id,
      },
    });
  }) as LegalDocumentRow;

  return formatDocument(normalizeLegalDocumentRow(updated));
}
