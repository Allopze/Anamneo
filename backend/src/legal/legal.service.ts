import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LegalDocument } from '@prisma/client';
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

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentPublishedDocuments() {
    const documents = await Promise.all(
      LEGAL_DOCUMENT_TYPES.map((type) => this.findCurrentPublishedDocument(type)),
    );

    return { documents: documents.filter((document): document is LegalDocumentPublic => Boolean(document)) };
  }

  async getCurrentPublishedDocument(type: string) {
    const documentType = this.normalizeDocumentType(type);
    const document = await this.findCurrentPublishedDocument(documentType);

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

    await Promise.all(
      LEGAL_DOCUMENT_TYPES.map((documentType) => {
        const document = currentDocuments[documentType];
        if (!document) {
          throw new BadRequestException(`No hay una versión vigente de ${LEGAL_DOCUMENT_LABELS[documentType]}`);
        }

        const data = this.buildAcceptanceRecord(userId, documentType, document.version, context);

        return this.prisma.userLegalAcceptance.upsert({
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
    const [acceptances, currentDocuments] = await Promise.all([
      this.prisma.userLegalAcceptance.findMany({
        where: { userId },
        orderBy: { acceptedAt: 'desc' },
        select: {
          documentType: true,
          version: true,
          acceptedAt: true,
        },
      }),
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

  async listAdminDocuments() {
    const documents = await this.prisma.legalDocument.findMany({
      orderBy: [{ type: 'asc' }, { status: 'asc' }, { updatedAt: 'desc' }],
    });

    return { documents: documents.map((document) => this.formatDocument(document)) };
  }

  async createDraft(user: LegalAdminUser, dto: CreateLegalDocumentDraftDto) {
    const type = this.normalizeDocumentType(dto.type);
    const source = dto.sourceDocumentId
      ? await this.prisma.legalDocument.findUnique({ where: { id: dto.sourceDocumentId } })
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
      });

      return this.formatDocument(created);
    } catch (error) {
      this.rethrowUniqueVersionError(error);
      throw error;
    }
  }

  async updateDraft(user: LegalAdminUser, id: string, dto: UpdateLegalDocumentDraftDto) {
    const document = await this.prisma.legalDocument.findUnique({ where: { id } });

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
      });

      return this.formatDocument(updated);
    } catch (error) {
      this.rethrowUniqueVersionError(error);
      throw error;
    }
  }

  async publishDraft(user: LegalAdminUser, id: string) {
    const document = await this.prisma.legalDocument.findUnique({ where: { id } });

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
    });

    return this.formatDocument(updated);
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

  private findCurrentPublishedDocumentRecord(type: LegalDocumentType) {
    return this.prisma.legalDocument.findFirst({
      where: {
        type,
        status: 'PUBLISHED',
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });
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

  private formatDocument(document: LegalDocument): LegalDocumentPublic {
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
    source: LegalDocument | null,
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
    const existing = await this.prisma.legalDocument.findMany({
      where: { type, version: { startsWith: base } },
      select: { version: true },
    });
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
