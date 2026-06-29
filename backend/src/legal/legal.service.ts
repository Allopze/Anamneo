import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LEGAL_DOCUMENT_LABELS, LEGAL_DOCUMENT_TYPES, type LegalDocumentPublic } from '../../../shared/legal-contract';
import { CreateLegalDocumentDraftDto, UpdateLegalDocumentDraftDto } from './dto/legal-document.dto';
import { publishLegalDocumentDraft } from './legal-publish-draft';
import { LEGAL_DOCUMENT_SELECT_SQL, USER_LEGAL_ACCEPTANCE_SELECT_SQL, assertAcceptanceAgainst, buildAcceptanceRecord, buildDraftVersion, findCurrentPublishedDocument, findCurrentPublishedDocumentRaw, findCurrentPublishedDocumentRecord, findCurrentPublishedDocumentRecordRaw, findLegalDocumentByIdRaw, formatDocument, normalizeDocumentType, normalizeLegalDocumentRow, normalizeUserLegalAcceptanceRow, parseEffectiveAt, requireDate, requireNonEmpty, resolveCreateContent, rethrowUniqueVersionError, supportsRawQueries, upsertUserLegalAcceptanceRaw, validateContentJson, type CurrentDocumentsByType, type LegalAdminUser, type LegalDocumentRecord, type LegalDocumentRow, type UserLegalAcceptanceRecord, type UserLegalAcceptanceRow } from './legal-service-helpers';
export interface LegalAcceptanceInput { acceptedTermsVersion?: string; acceptedPrivacyVersion?: string; }
export interface LegalAcceptanceContext { ipAddress?: string | null; userAgent?: string | null; }
@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}
  async getCurrentPublishedDocuments() {
    if (supportsRawQueries(this.prisma)) {
      const documents = await Promise.all(
        LEGAL_DOCUMENT_TYPES.map((type) => findCurrentPublishedDocumentRaw(this.prisma, type)),
      );
      return { documents: documents.filter((document): document is LegalDocumentPublic => Boolean(document)) };
    }
    const documents = await Promise.all(
      LEGAL_DOCUMENT_TYPES.map((type) => findCurrentPublishedDocument(this.prisma, type)),
    );
    return { documents: documents.filter((document): document is LegalDocumentPublic => Boolean(document)) };
  }
  async getCurrentPublishedDocument(type: string) {
    const documentType = normalizeDocumentType(type);
    const document = supportsRawQueries(this.prisma)
      ? await findCurrentPublishedDocumentRaw(this.prisma, documentType)
      : await findCurrentPublishedDocument(this.prisma, documentType);
    if (!document) {
      throw new NotFoundException(`No hay una versión publicada para ${LEGAL_DOCUMENT_LABELS[documentType]}`);
    }
    return document;
  }
  async assertCurrentAcceptance(input: LegalAcceptanceInput) {
    const currentDocuments = await this.getCurrentDocumentsByType();
    assertAcceptanceAgainst(input, currentDocuments);
  }
  async recordCurrentAcceptance(
    userId: string,
    input: LegalAcceptanceInput,
    context?: LegalAcceptanceContext,
  ) {
    const currentDocuments = await this.getCurrentDocumentsByType();
    assertAcceptanceAgainst(input, currentDocuments);
    if (supportsRawQueries(this.prisma)) {
      await Promise.all(
        LEGAL_DOCUMENT_TYPES.map(async (documentType) => {
          const document = currentDocuments[documentType];
          if (!document) {
            throw new BadRequestException(`No hay una versión vigente de ${LEGAL_DOCUMENT_LABELS[documentType]}`);
          }
          await upsertUserLegalAcceptanceRaw(
            this.prisma,
            userId,
            documentType,
            document.version,
            context,
          );
        }),
      );
      return;
    }
    await Promise.all(
      LEGAL_DOCUMENT_TYPES.map((documentType) => {
        const document = currentDocuments[documentType];
        if (!document) {
          throw new BadRequestException(`No hay una versión vigente de ${LEGAL_DOCUMENT_LABELS[documentType]}`);
        }
        const data = buildAcceptanceRecord(userId, documentType, document.version, context);
        const prisma = this.prisma as any;
        return prisma.userLegalAcceptance.upsert({
          where: {
            userId_documentType_version: {
              userId,
              documentType,
              version: document.version,
            },
          },
          create: data,
          update: {
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
          },
        });
      }),
    );
  }
  async listUserAcceptances(userId: string) {
    if (supportsRawQueries(this.prisma)) {
      const [acceptances, currentDocuments] = await Promise.all([
        this.prisma.$queryRawUnsafe<UserLegalAcceptanceRecord[]>(
          `${USER_LEGAL_ACCEPTANCE_SELECT_SQL} WHERE user_id = $1 ORDER BY accepted_at DESC`,
          userId,
        ),
        this.getCurrentDocumentsByType(),
      ]);
      return {
        documents: LEGAL_DOCUMENT_TYPES.map((type) => ({
          type,
          label: LEGAL_DOCUMENT_LABELS[type],
          currentVersion: currentDocuments[type]?.version ?? null,
          latestAccepted: acceptances.find((acceptance) => acceptance.documentType === type) ?? null,
        })),
      };
    }
    const prisma = this.prisma as any;
    const [acceptances, currentDocuments] = await Promise.all([
      prisma.userLegalAcceptance.findMany({
        where: { userId },
        orderBy: { acceptedAt: 'desc' },
        select: {
          documentType: true,
          version: true,
          acceptedAt: true,
        },
      }) as Promise<UserLegalAcceptanceRow[]>,
      this.getCurrentDocumentsByType(),
    ]);
    const normalizedAcceptances = acceptances.map((acceptance) => normalizeUserLegalAcceptanceRow(acceptance));
    return {
      documents: LEGAL_DOCUMENT_TYPES.map((type) => ({
        type,
        label: LEGAL_DOCUMENT_LABELS[type],
        currentVersion: currentDocuments[type]?.version ?? null,
        latestAccepted: normalizedAcceptances.find((acceptance) => acceptance.documentType === type) ?? null,
      })),
    };
  }
  async listAdminDocuments() {
    if (supportsRawQueries(this.prisma)) {
      const documents = await this.prisma.$queryRawUnsafe<LegalDocumentRecord[]>(
        `${LEGAL_DOCUMENT_SELECT_SQL} ORDER BY type ASC, status ASC, updated_at DESC`,
      );
      return { documents: documents.map((document) => formatDocument(normalizeLegalDocumentRow(document))) };
    }
    const prisma = this.prisma as any;
    const documents = await prisma.legalDocument.findMany({
      orderBy: [{ type: 'asc' }, { status: 'asc' }, { updatedAt: 'desc' }],
    }) as LegalDocumentRow[];
    return { documents: documents.map((document) => formatDocument(normalizeLegalDocumentRow(document))) };
  }
  async createDraft(user: LegalAdminUser, dto: CreateLegalDocumentDraftDto) {
    const type = normalizeDocumentType(dto.type);
    if (supportsRawQueries(this.prisma)) {
      const source = dto.sourceDocumentId
        ? await findLegalDocumentByIdRaw(this.prisma, dto.sourceDocumentId)
        : await findCurrentPublishedDocumentRecordRaw(this.prisma, type);
      if (dto.sourceDocumentId && (!source || source.type !== type)) {
        throw new NotFoundException('No se encontró el documento base para crear el borrador');
      }
      const contentJson = resolveCreateContent(dto, source);
      const version = dto.version?.trim() || await buildDraftVersion(this.prisma, type);
      const effectiveAt = parseEffectiveAt(dto.effectiveAt) ?? source?.effectiveAt ?? new Date();
      const id = crypto.randomUUID();
      try {
        await this.prisma.$executeRawUnsafe(
          'INSERT INTO legal_documents (id, type, version, status, title, description, content_json, effective_at, published_at, created_by_id, updated_by_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          id,
          type,
          version,
          'DRAFT',
          dto.title?.trim() || source?.title || LEGAL_DOCUMENT_LABELS[type],
          dto.description?.trim() || source?.description || '',
          JSON.stringify(contentJson),
          effectiveAt,
          null,
          user.id,
          user.id,
        );
        const created = await findLegalDocumentByIdRaw(this.prisma, id);
        if (!created) {
          throw new Error('No se pudo crear el borrador legal');
        }
        return formatDocument(created);
      } catch (error) {
        rethrowUniqueVersionError(error);
        throw error;
      }
    }
    const prisma = this.prisma as any;
    const source = dto.sourceDocumentId
      ? await prisma.legalDocument.findUnique({ where: { id: dto.sourceDocumentId } })
      : await findCurrentPublishedDocumentRecord(this.prisma, type);
    if (dto.sourceDocumentId && (!source || source.type !== type)) {
      throw new NotFoundException('No se encontró el documento base para crear el borrador');
    }
    const contentJson = resolveCreateContent(dto, source);
    const version = dto.version?.trim() || await buildDraftVersion(this.prisma, type);
    const effectiveAt = parseEffectiveAt(dto.effectiveAt) ?? source?.effectiveAt ?? new Date();
    try {
      const created = await this.prisma.legalDocument.create({
        data: {
          type,
          version,
          status: 'DRAFT',
          title: dto.title?.trim() || source?.title || LEGAL_DOCUMENT_LABELS[type],
          description: dto.description?.trim() || source?.description || '',
          contentJson: JSON.stringify(contentJson),
          effectiveAt,
          createdById: user.id,
          updatedById: user.id,
        },
      }) as LegalDocumentRow;
      return formatDocument(normalizeLegalDocumentRow(created));
    } catch (error) {
      rethrowUniqueVersionError(error);
      throw error;
    }
  }
  async updateDraft(user: LegalAdminUser, id: string, dto: UpdateLegalDocumentDraftDto) {
    if (supportsRawQueries(this.prisma)) {
      const document = await findLegalDocumentByIdRaw(this.prisma, id);
      if (!document) {
        throw new NotFoundException('No se encontró el documento legal');
      }
      if (document.status !== 'DRAFT') {
        throw new BadRequestException('Solo los borradores pueden editarse');
      }
      const nextVersion = dto.version !== undefined ? requireNonEmpty(dto.version, 'La versión no puede quedar vacía') : document.version;
      const nextTitle = dto.title !== undefined ? requireNonEmpty(dto.title, 'El título no puede quedar vacío') : document.title;
      const nextDescription = dto.description !== undefined ? dto.description.trim() : document.description;
      const nextEffectiveAt = dto.effectiveAt !== undefined ? requireDate(dto.effectiveAt) : document.effectiveAt;
      const nextContentJson = dto.contentJson !== undefined
        ? JSON.stringify(validateContentJson(dto.contentJson))
        : document.contentJson;
      try {
        await this.prisma.$executeRawUnsafe(
          'UPDATE legal_documents SET version = $1, title = $2, description = $3, effective_at = $4, content_json = $5, updated_by_id = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
          nextVersion,
          nextTitle,
          nextDescription,
          nextEffectiveAt,
          nextContentJson,
          user.id,
          id,
        );
        const updated = await findLegalDocumentByIdRaw(this.prisma, id);
        if (!updated) {
          throw new Error('No se pudo actualizar el borrador legal');
        }
        return formatDocument(normalizeLegalDocumentRow(updated));
      } catch (error) {
        rethrowUniqueVersionError(error);
        throw error;
      }
    }
    const prisma = this.prisma as any;
    const document = await prisma.legalDocument.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException('No se encontró el documento legal');
    }
    if (document.status !== 'DRAFT') {
      throw new BadRequestException('Solo los borradores pueden editarse');
    }
    const data: Prisma.LegalDocumentUpdateInput = {
      updatedById: user.id,
    };
    if (dto.version !== undefined) {
      data.version = requireNonEmpty(dto.version, 'La versión no puede quedar vacía');
    }
    if (dto.title !== undefined) {
      data.title = requireNonEmpty(dto.title, 'El título no puede quedar vacío');
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.effectiveAt !== undefined) {
      data.effectiveAt = requireDate(dto.effectiveAt);
    }
    if (dto.contentJson !== undefined) {
      data.contentJson = JSON.stringify(validateContentJson(dto.contentJson));
    }
    try {
      const updated = await this.prisma.legalDocument.update({
        where: { id },
        data,
      }) as LegalDocumentRow;
      return formatDocument(normalizeLegalDocumentRow(updated));
    } catch (error) {
      rethrowUniqueVersionError(error);
      throw error;
    }
  }
  async publishDraft(user: LegalAdminUser, id: string) {
    return publishLegalDocumentDraft(this.prisma, user, id);
  }
  private async getCurrentDocumentsByType(): Promise<CurrentDocumentsByType> {
    const documents = await this.getCurrentPublishedDocuments();
    return LEGAL_DOCUMENT_TYPES.reduce((acc, type) => {
      acc[type] = documents.documents.find((document) => document.type === type) ?? null;
      return acc;
    }, {} as CurrentDocumentsByType);
  }
}
