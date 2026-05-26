import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import {
  LEGAL_DOCUMENT_LABELS,
  isSupportedLegalDocumentType,
  type LegalDocumentContentJson,
  type LegalDocumentPublic,
  type LegalDocumentType,
} from '../../../shared/legal-contract';
import { PrismaService } from '../prisma/prisma.service';
import { encryptNetMeta } from '../common/utils/field-crypto';
import { CreateLegalDocumentDraftDto } from './dto/legal-document.dto';
import type { LegalAcceptanceContext, LegalAcceptanceInput } from './legal.service';

export type CurrentDocumentsByType = Record<LegalDocumentType, LegalDocumentPublic | null>;
export type LegalAdminUser = { id: string };

export type RawLegalClient = {
  $executeRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

export type LegalDocumentRecord = {
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

export type LegalDocumentRow = Omit<LegalDocumentRecord, 'type' | 'effectiveAt' | 'publishedAt'> & {
  type: string;
  effectiveAt: Date | string;
  publishedAt: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type UserLegalAcceptanceRecord = {
  documentType: LegalDocumentType;
  version: string;
  acceptedAt: Date;
};

export type UserLegalAcceptanceRow = Omit<UserLegalAcceptanceRecord, 'documentType' | 'acceptedAt'> & {
  documentType: string;
  acceptedAt: Date | string;
};

export function supportsRawQueries(client: unknown): client is RawLegalClient {
  return !!client
    && typeof (client as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === 'function'
    && typeof (client as { $queryRawUnsafe?: unknown }).$queryRawUnsafe === 'function';
}

export const LEGAL_DOCUMENT_SELECT_SQL = `
  SELECT
    id,
    type,
    version,
    status,
    title,
    description,
    content_json AS "contentJson",
    effective_at AS "effectiveAt",
    published_at AS "publishedAt",
    created_by_id AS "createdById",
    updated_by_id AS "updatedById"
  FROM legal_documents
`;

export const USER_LEGAL_ACCEPTANCE_SELECT_SQL = `
  SELECT
    document_type AS "documentType",
    version,
    accepted_at AS "acceptedAt"
  FROM user_legal_acceptances
`;

export function assertAcceptanceAgainst(
  input: LegalAcceptanceInput,
  documents: CurrentDocumentsByType,
) {
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

export function normalizeDocumentType(value: string): LegalDocumentType {
  if (!isSupportedLegalDocumentType(value)) {
    throw new BadRequestException('Tipo de documento legal no soportado');
  }
  return value;
}

export function validateContentJson(value: unknown): LegalDocumentContentJson {
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

export function parseContentJson(value: string): LegalDocumentContentJson {
  try {
    return validateContentJson(JSON.parse(value));
  } catch {
    throw new BadRequestException('El contenido legal guardado no tiene formato JSON válido');
  }
}

export function normalizeLegalDocumentRow(document: LegalDocumentRow): LegalDocumentRecord {
  return {
    ...document,
    type: normalizeDocumentType(document.type),
    effectiveAt: new Date(document.effectiveAt),
    publishedAt: document.publishedAt ? new Date(document.publishedAt) : null,
  };
}

export function normalizeUserLegalAcceptanceRow(
  acceptance: UserLegalAcceptanceRow,
): UserLegalAcceptanceRecord {
  return {
    documentType: normalizeDocumentType(acceptance.documentType),
    version: acceptance.version,
    acceptedAt: new Date(acceptance.acceptedAt),
  };
}

export function formatDocument(document: LegalDocumentRecord): LegalDocumentPublic {
  return {
    id: document.id,
    type: normalizeDocumentType(document.type),
    status: document.status as LegalDocumentPublic['status'],
    title: document.title,
    description: document.description,
    version: document.version,
    effectiveAt: document.effectiveAt.toISOString(),
    publishedAt: document.publishedAt?.toISOString() ?? null,
    contentJson: parseContentJson(document.contentJson),
  };
}

export function resolveCreateContent(
  dto: CreateLegalDocumentDraftDto,
  source: LegalDocumentRecord | null,
) {
  if (dto.contentJson) return validateContentJson(dto.contentJson);
  if (source) return parseContentJson(source.contentJson);
  throw new BadRequestException('Debes entregar contenido JSON o crear el borrador desde una versión existente');
}

export function requireDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('La fecha de vigencia no es válida');
  }
  return date;
}

export function parseEffectiveAt(value?: string) {
  return value ? requireDate(value) : null;
}

export function requireNonEmpty(value: string, message: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new BadRequestException(message);
  return trimmed;
}

export function buildAcceptanceRecord(
  userId: string,
  documentType: LegalDocumentType,
  version: string,
  context?: LegalAcceptanceContext,
) {
  return {
    userId,
    documentType,
    version,
    ipAddress: encryptNetMeta(context?.ipAddress ?? null),
    userAgent: encryptNetMeta(context?.userAgent ?? null),
  };
}

export async function findCurrentPublishedDocument(prisma: PrismaService, type: LegalDocumentType) {
  const document = await findCurrentPublishedDocumentRecord(prisma, type);
  return document ? formatDocument(document) : null;
}

export async function findCurrentPublishedDocumentRecord(
  prismaService: PrismaService,
  type: LegalDocumentType,
) {
  const prisma = prismaService as any;
  const document = await prisma.legalDocument.findFirst({
    where: { type, status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
  }) as LegalDocumentRow | null;
  return document ? normalizeLegalDocumentRow(document) : null;
}

export async function findCurrentPublishedDocumentRaw(prisma: PrismaService, type: LegalDocumentType) {
  const [document] = await prisma.$queryRawUnsafe<LegalDocumentRecord[]>(
    `${LEGAL_DOCUMENT_SELECT_SQL} WHERE type = $1 AND status = $2 ORDER BY published_at DESC, updated_at DESC LIMIT 1`,
    type,
    'PUBLISHED',
  );
  return document ? formatDocument(normalizeLegalDocumentRow(document)) : null;
}

export async function findCurrentPublishedDocumentRecordRaw(
  prisma: PrismaService,
  type: LegalDocumentType,
) {
  const [document] = await prisma.$queryRawUnsafe<LegalDocumentRecord[]>(
    `${LEGAL_DOCUMENT_SELECT_SQL} WHERE type = $1 AND status = $2 ORDER BY published_at DESC, updated_at DESC LIMIT 1`,
    type,
    'PUBLISHED',
  );
  return document ? normalizeLegalDocumentRow(document) : null;
}

export async function findLegalDocumentByIdRaw(prisma: PrismaService, id: string) {
  const [document] = await prisma.$queryRawUnsafe<LegalDocumentRecord[]>(
    `${LEGAL_DOCUMENT_SELECT_SQL} WHERE id = $1 LIMIT 1`,
    id,
  );
  return document ? normalizeLegalDocumentRow(document) : null;
}

export async function upsertUserLegalAcceptanceRaw(
  prisma: PrismaService,
  userId: string,
  documentType: LegalDocumentType,
  version: string,
  context?: LegalAcceptanceContext,
) {
  await prisma.$executeRawUnsafe(
    'INSERT INTO user_legal_acceptances (id, user_id, document_type, version, accepted_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(user_id, document_type, version) DO UPDATE SET ip_address = excluded.ip_address, user_agent = excluded.user_agent',
    crypto.randomUUID(),
    userId,
    documentType,
    version,
    new Date(),
    encryptNetMeta(context?.ipAddress ?? null),
    encryptNetMeta(context?.userAgent ?? null),
  );
}

export async function buildDraftVersion(prisma: PrismaService, type: LegalDocumentType) {
  const base = new Date().toISOString().slice(0, 10);
  const existing: Array<{ version: string }> = supportsRawQueries(prisma)
    ? await prisma.$queryRawUnsafe<Array<{ version: string }>>(
      'SELECT version FROM legal_documents WHERE type = $1 AND version LIKE $2',
      type,
      `${base}%`,
    )
    : await (prisma as any).legalDocument.findMany({
      where: { type, version: { startsWith: base } },
      select: { version: true },
    }) as Array<{ version: string }>;
  const versions = new Set(existing.map((document) => document.version));
  if (!versions.has(base)) return base;

  let index = 2;
  while (versions.has(`${base}-r${index}`)) index += 1;
  return `${base}-r${index}`;
}

export function rethrowUniqueVersionError(error: unknown): never | void {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new BadRequestException('Ya existe un documento legal con ese tipo y versión');
  }
}
