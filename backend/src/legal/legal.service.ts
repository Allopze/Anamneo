import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEGAL_DOCUMENT_LABELS,
  LEGAL_DOCUMENT_TYPES,
  isSupportedLegalDocumentType,
  type LegalDocumentContentJson,
  type LegalDocumentPublic,
  type LegalDocumentType,
} from '../../../shared/legal-contract';
import { CreateLegalDocumentDraftDto, UpdateLegalDocumentDraftDto } from './dto/legal-document.dto';

export interface LegalAcceptanceInput {
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
}

export interface LegalAcceptanceContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

type CurrentDocumentsByType = Record<LegalDocumentType, LegalDocumentPublic | null>;
type LegalAdminUser = { id: string };

type RawLegalClient = {
  $executeRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

type LegalDocumentRecord = {
  id: string;
  type: LegalDocumentType;
  version: string;
  status: string;
  title: string;
  description: string;
  contentJson: string;
  effectiveAt: Date;
  publishedAt: Date | null;
  createdById: string | null;
  updatedById: string | null;
};

type LegalDocumentRow = Omit<LegalDocumentRecord, 'type' | 'effectiveAt' | 'publishedAt'> & {
  type: string;
  effectiveAt: Date | string;
  publishedAt: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type UserLegalAcceptanceRecord = {
  documentType: LegalDocumentType;
  version: string;
  acceptedAt: Date;
};

type UserLegalAcceptanceRow = Omit<UserLegalAcceptanceRecord, 'documentType' | 'acceptedAt'> & {
  documentType: string;
  acceptedAt: Date | string;
};

function supportsRawQueries(client: unknown): client is RawLegalClient {
  return !!client
    && typeof (client as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === 'function'
    && typeof (client as { $queryRawUnsafe?: unknown }).$queryRawUnsafe === 'function';
}

const LEGAL_DOCUMENT_SELECT_SQL = `
  SELECT
    id,
    type,
    version,
    status,
    title,
    description,
    content_json AS contentJson,
    effective_at AS effectiveAt,
    published_at AS publishedAt,
    created_by_id AS createdById,
    updated_by_id AS updatedById
  FROM legal_documents
`;

const USER_LEGAL_ACCEPTANCE_SELECT_SQL = `
  SELECT
    document_type AS documentType,
    version,
    accepted_at AS acceptedAt
  FROM user_legal_acceptances
`;

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentPublishedDocuments() {
    if (supportsRawQueries(this.prisma)) {
      const documents = await Promise.all(
        LEGAL_DOCUMENT_TYPES.map((type) => this.findCurrentPublishedDocumentRaw(type)),
      );

      return { documents: documents.filter((document): document is LegalDocumentPublic => Boolean(document)) };
    }

    const documents = await Promise.all(
      LEGAL_DOCUMENT_TYPES.map((type) => this.findCurrentPublishedDocument(type)),
    );

    return { documents: documents.filter((document): document is LegalDocumentPublic => Boolean(document)) };
  }

  async getCurrentPublishedDocument(type: string) {
    const documentType = this.normalizeDocumentType(type);
    const document = supportsRawQueries(this.prisma)
      ? await this.findCurrentPublishedDocumentRaw(documentType)
      : await this.findCurrentPublishedDocument(documentType);

    if (!document) {
      throw new NotFoundException(`No hay una versión publicada para ${LEGAL_DOCUMENT_LABELS[documentType]}`);
    }

    return document;
  }

  async assertCurrentAcceptance(input: LegalAcceptanceInput) {
    const currentDocuments = await this.getCurrentDocumentsByType();
    this.assertAcceptanceAgainst(input, currentDocuments);
  }

  async recordCurrentAcceptance(
    userId: string,
    input: LegalAcceptanceInput,
    context?: LegalAcceptanceContext,
  ) {
    const currentDocuments = await this.getCurrentDocumentsByType();
    this.assertAcceptanceAgainst(input, currentDocuments);

    if (supportsRawQueries(this.prisma)) {
      await Promise.all(
        LEGAL_DOCUMENT_TYPES.map(async (documentType) => {
          const document = currentDocuments[documentType];
          if (!document) {
            throw new BadRequestException(`No hay una versión vigente de ${LEGAL_DOCUMENT_LABELS[documentType]}`);
          }

          await this.upsertUserLegalAcceptanceRaw(
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

        const data = this.buildAcceptanceRecord(userId, documentType, document.version, context);

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
    const normalizedAcceptances = acceptances.map((acceptance) => this.normalizeUserLegalAcceptanceRow(acceptance));

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

          return { documents: documents.map((document) => this.formatDocument(this.normalizeLegalDocumentRow(document))) };
    }

    const prisma = this.prisma as any;
    const documents = await prisma.legalDocument.findMany({
      orderBy: [{ type: 'asc' }, { status: 'asc' }, { updatedAt: 'desc' }],
    }) as LegalDocumentRow[];

    return { documents: documents.map((document) => this.formatDocument(this.normalizeLegalDocumentRow(document))) };
  }

  async createDraft(user: LegalAdminUser, dto: CreateLegalDocumentDraftDto) {
    const type = this.normalizeDocumentType(dto.type);

    if (supportsRawQueries(this.prisma)) {
      const source = dto.sourceDocumentId
        ? await this.findLegalDocumentByIdRaw(dto.sourceDocumentId)
        : await this.findCurrentPublishedDocumentRecordRaw(type);

      if (dto.sourceDocumentId && (!source || source.type !== type)) {
        throw new NotFoundException('No se encontró el documento base para crear el borrador');
      }

      const contentJson = this.resolveCreateContent(dto, source);
      const version = dto.version?.trim() || await this.buildDraftVersion(type);
      const effectiveAt = this.parseEffectiveAt(dto.effectiveAt) ?? source?.effectiveAt ?? new Date();
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

        const created = await this.findLegalDocumentByIdRaw(id);
        if (!created) {
          throw new Error('No se pudo crear el borrador legal');
        }

        return this.formatDocument(created);
      } catch (error) {
        this.rethrowUniqueVersionError(error);
        throw error;
      }
    }

    const prisma = this.prisma as any;
    const source = dto.sourceDocumentId
      ? await prisma.legalDocument.findUnique({ where: { id: dto.sourceDocumentId } })
      : await this.findCurrentPublishedDocumentRecord(type);

    if (dto.sourceDocumentId && (!source || source.type !== type)) {
      throw new NotFoundException('No se encontró el documento base para crear el borrador');
    }

    const contentJson = this.resolveCreateContent(dto, source);
    const version = dto.version?.trim() || await this.buildDraftVersion(type);
    const effectiveAt = this.parseEffectiveAt(dto.effectiveAt) ?? source?.effectiveAt ?? new Date();

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

      return this.formatDocument(this.normalizeLegalDocumentRow(created));
    } catch (error) {
      this.rethrowUniqueVersionError(error);
      throw error;
    }
  }

  async updateDraft(user: LegalAdminUser, id: string, dto: UpdateLegalDocumentDraftDto) {
    if (supportsRawQueries(this.prisma)) {
      const document = await this.findLegalDocumentByIdRaw(id);

      if (!document) {
        throw new NotFoundException('No se encontró el documento legal');
      }
      if (document.status !== 'DRAFT') {
        throw new BadRequestException('Solo los borradores pueden editarse');
      }

      const nextVersion = dto.version !== undefined ? this.requireNonEmpty(dto.version, 'La versión no puede quedar vacía') : document.version;
      const nextTitle = dto.title !== undefined ? this.requireNonEmpty(dto.title, 'El título no puede quedar vacío') : document.title;
      const nextDescription = dto.description !== undefined ? dto.description.trim() : document.description;
      const nextEffectiveAt = dto.effectiveAt !== undefined ? this.requireDate(dto.effectiveAt) : document.effectiveAt;
      const nextContentJson = dto.contentJson !== undefined
        ? JSON.stringify(this.validateContentJson(dto.contentJson))
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

        const updated = await this.findLegalDocumentByIdRaw(id);
        if (!updated) {
          throw new Error('No se pudo actualizar el borrador legal');
        }

            return this.formatDocument(this.normalizeLegalDocumentRow(updated));
      } catch (error) {
        this.rethrowUniqueVersionError(error);
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
      data.version = this.requireNonEmpty(dto.version, 'La versión no puede quedar vacía');
    }
    if (dto.title !== undefined) {
      data.title = this.requireNonEmpty(dto.title, 'El título no puede quedar vacío');
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.effectiveAt !== undefined) {
      data.effectiveAt = this.requireDate(dto.effectiveAt);
    }
    if (dto.contentJson !== undefined) {
      data.contentJson = JSON.stringify(this.validateContentJson(dto.contentJson));
    }

    try {
      const updated = await this.prisma.legalDocument.update({
        where: { id },
        data,
      }) as LegalDocumentRow;

      return this.formatDocument(this.normalizeLegalDocumentRow(updated));
    } catch (error) {
      this.rethrowUniqueVersionError(error);
      throw error;
    }
  }

  async publishDraft(user: LegalAdminUser, id: string) {
    if (supportsRawQueries(this.prisma)) {
      const document = await this.findLegalDocumentByIdRaw(id);

      if (!document) {
        throw new NotFoundException('No se encontró el documento legal');
      }
      if (document.status !== 'DRAFT') {
        throw new BadRequestException('Solo un borrador puede publicarse');
      }

      const now = new Date();
      const updated = await this.prisma.$transaction(async (tx) => {
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

      return this.formatDocument(updated);
    }

    const prisma = this.prisma as any;
    const document = await prisma.legalDocument.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException('No se encontró el documento legal');
    }
    if (document.status !== 'DRAFT') {
      throw new BadRequestException('Solo un borrador puede publicarse');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
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

    return this.formatDocument(this.normalizeLegalDocumentRow(updated));
  }

  private async getCurrentDocumentsByType(): Promise<CurrentDocumentsByType> {
    const documents = await this.getCurrentPublishedDocuments();
    return LEGAL_DOCUMENT_TYPES.reduce((acc, type) => {
      acc[type] = documents.documents.find((document) => document.type === type) ?? null;
      return acc;
    }, {} as CurrentDocumentsByType);
  }

  private assertAcceptanceAgainst(input: LegalAcceptanceInput, documents: CurrentDocumentsByType) {
    if (!documents.TERMS || input.acceptedTermsVersion !== documents.TERMS.version) {
      throw new BadRequestException(
        `Debes aceptar los ${LEGAL_DOCUMENT_LABELS.TERMS} vigentes para crear la cuenta`,
      );
    }

    if (!documents.PRIVACY || input.acceptedPrivacyVersion !== documents.PRIVACY.version) {
      throw new BadRequestException(
        `Debes aceptar la ${LEGAL_DOCUMENT_LABELS.PRIVACY} vigente para crear la cuenta`,
      );
    }
  }

  private async findCurrentPublishedDocument(type: LegalDocumentType) {
    const document = await this.findCurrentPublishedDocumentRecord(type);
    return document ? this.formatDocument(document) : null;
  }

  private async findCurrentPublishedDocumentRecord(type: LegalDocumentType) {
    const prisma = this.prisma as any;
    const document = await prisma.legalDocument.findFirst({
      where: {
        type,
        status: 'PUBLISHED',
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    }) as LegalDocumentRow | null;

    return document ? this.normalizeLegalDocumentRow(document) : null;
  }

  private async findCurrentPublishedDocumentRaw(type: LegalDocumentType) {
    const [document] = await this.prisma.$queryRawUnsafe<LegalDocumentRecord[]>(
      `${LEGAL_DOCUMENT_SELECT_SQL} WHERE type = $1 AND status = $2 ORDER BY published_at DESC, updated_at DESC LIMIT 1`,
      type,
      'PUBLISHED',
    );

    return document ? this.formatDocument(this.normalizeLegalDocumentRow(document)) : null;
  }

  private async findCurrentPublishedDocumentRecordRaw(type: LegalDocumentType) {
    const [document] = await this.prisma.$queryRawUnsafe<LegalDocumentRecord[]>(
      `${LEGAL_DOCUMENT_SELECT_SQL} WHERE type = $1 AND status = $2 ORDER BY published_at DESC, updated_at DESC LIMIT 1`,
      type,
      'PUBLISHED',
    );

    return document ? this.normalizeLegalDocumentRow(document) : null;
  }

  private async findLegalDocumentByIdRaw(id: string) {
    const [document] = await this.prisma.$queryRawUnsafe<LegalDocumentRecord[]>(
      `${LEGAL_DOCUMENT_SELECT_SQL} WHERE id = $1 LIMIT 1`,
      id,
    );

    return document ? this.normalizeLegalDocumentRow(document) : null;
  }

  private async upsertUserLegalAcceptanceRaw(
    userId: string,
    documentType: LegalDocumentType,
    version: string,
    context?: LegalAcceptanceContext,
  ) {
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO user_legal_acceptances (id, user_id, document_type, version, accepted_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(user_id, document_type, version) DO UPDATE SET ip_address = excluded.ip_address, user_agent = excluded.user_agent',
      crypto.randomUUID(),
      userId,
      documentType,
      version,
      new Date(),
      context?.ipAddress ?? null,
      context?.userAgent ?? null,
    );
  }

  private buildAcceptanceRecord(
    userId: string,
    documentType: LegalDocumentType,
    version: string,
    context?: LegalAcceptanceContext,
  ) {
    return {
      userId,
      documentType,
      version,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    };
  }

  private formatDocument(document: LegalDocumentRecord): LegalDocumentPublic {
    return {
      id: document.id,
      type: this.normalizeDocumentType(document.type),
      status: document.status as LegalDocumentPublic['status'],
      title: document.title,
      description: document.description,
      version: document.version,
      effectiveAt: document.effectiveAt.toISOString(),
      publishedAt: document.publishedAt?.toISOString() ?? null,
      contentJson: this.parseContentJson(document.contentJson),
    };
  }

  private normalizeLegalDocumentRow(document: LegalDocumentRow): LegalDocumentRecord {
    return {
      ...document,
      type: this.normalizeDocumentType(document.type),
      effectiveAt: new Date(document.effectiveAt),
      publishedAt: document.publishedAt ? new Date(document.publishedAt) : null,
    };
  }

  private normalizeUserLegalAcceptanceRow(acceptance: UserLegalAcceptanceRow): UserLegalAcceptanceRecord {
    return {
      documentType: this.normalizeDocumentType(acceptance.documentType),
      version: acceptance.version,
      acceptedAt: new Date(acceptance.acceptedAt),
    };
  }

  private normalizeDocumentType(value: string): LegalDocumentType {
    if (!isSupportedLegalDocumentType(value)) {
      throw new BadRequestException('Tipo de documento legal no soportado');
    }

    return value;
  }

  private parseContentJson(value: string): LegalDocumentContentJson {
    try {
      return this.validateContentJson(JSON.parse(value));
    } catch {
      throw new BadRequestException('El contenido legal guardado no tiene formato JSON válido');
    }
  }

  private validateContentJson(value: unknown): LegalDocumentContentJson {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('El contenido legal debe ser un objeto JSON');
    }

    const content = value as LegalDocumentContentJson;
    if (!Array.isArray(content.summary) || !content.summary.every((item) => typeof item === 'string')) {
      throw new BadRequestException('El contenido legal debe incluir un resumen válido');
    }
    if (!Array.isArray(content.sections) || content.sections.length === 0) {
      throw new BadRequestException('El contenido legal debe incluir secciones');
    }

    for (const section of content.sections) {
      if (
        typeof section.id !== 'string'
        || typeof section.title !== 'string'
        || !Array.isArray(section.body)
        || !section.body.every((paragraph) => typeof paragraph === 'string')
      ) {
        throw new BadRequestException('Cada sección legal debe tener id, título y párrafos válidos');
      }
    }

    return content;
  }

  private resolveCreateContent(
    dto: CreateLegalDocumentDraftDto,
    source: LegalDocumentRecord | null,
  ) {
    if (dto.contentJson) {
      return this.validateContentJson(dto.contentJson);
    }
    if (source) {
      return this.parseContentJson(source.contentJson);
    }

    throw new BadRequestException('Debes entregar contenido JSON o crear el borrador desde una versión existente');
  }

  private parseEffectiveAt(value?: string) {
    return value ? this.requireDate(value) : null;
  }

  private requireDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha de vigencia no es válida');
    }

    return date;
  }

  private requireNonEmpty(value: string, message: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(message);
    }

    return trimmed;
  }

  private async buildDraftVersion(type: LegalDocumentType) {
    const base = new Date().toISOString().slice(0, 10);
    const existing: Array<{ version: string }> = supportsRawQueries(this.prisma)
      ? await this.prisma.$queryRawUnsafe<Array<{ version: string }>>(
        'SELECT version FROM legal_documents WHERE type = $1 AND version LIKE $2',
        type,
        `${base}%`,
      )
      : await (this.prisma as any).legalDocument.findMany({
        where: { type, version: { startsWith: base } },
        select: { version: true },
      }) as Array<{ version: string }>;
    const versions = new Set(existing.map((document) => document.version));

    if (!versions.has(base)) {
      return base;
    }

    let index = 2;
    while (versions.has(`${base}-r${index}`)) {
      index += 1;
    }

    return `${base}-r${index}`;
  }

  private rethrowUniqueVersionError(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('Ya existe un documento legal con ese tipo y versión');
    }
  }
}
