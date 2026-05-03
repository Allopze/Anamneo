import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEGAL_DOCUMENT_LABELS,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_VERSION,
  type LegalDocumentType,
} from '../../../shared/legal-contract';

export interface LegalAcceptanceInput {
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
}

export interface LegalAcceptanceContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  assertCurrentAcceptance(input: LegalAcceptanceInput) {
    if (input.acceptedTermsVersion !== LEGAL_DOCUMENT_VERSION) {
      throw new BadRequestException(
        `Debes aceptar los ${LEGAL_DOCUMENT_LABELS.TERMS} vigentes para crear la cuenta`,
      );
    }

    if (input.acceptedPrivacyVersion !== LEGAL_DOCUMENT_VERSION) {
      throw new BadRequestException(
        `Debes aceptar la ${LEGAL_DOCUMENT_LABELS.PRIVACY} vigente para crear la cuenta`,
      );
    }
  }

  async recordCurrentAcceptance(
    userId: string,
    input: LegalAcceptanceInput,
    context?: LegalAcceptanceContext,
  ) {
    this.assertCurrentAcceptance(input);

    await Promise.all(
      (['TERMS', 'PRIVACY'] as const).map((documentType) => {
        const data = this.buildAcceptanceRecord(userId, documentType, context);

        return this.prisma.userLegalAcceptance.upsert({
          where: {
            userId_documentType_version: {
              userId,
              documentType,
              version: LEGAL_DOCUMENT_VERSION,
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
    const acceptances = await this.prisma.userLegalAcceptance.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
      select: {
        documentType: true,
        version: true,
        acceptedAt: true,
      },
    });

    return {
      currentVersion: LEGAL_DOCUMENT_VERSION,
      documents: LEGAL_DOCUMENT_TYPES.map((type) => ({
        type,
        label: LEGAL_DOCUMENT_LABELS[type],
        currentVersion: LEGAL_DOCUMENT_VERSION,
        latestAccepted: acceptances.find((acceptance) => acceptance.documentType === type) ?? null,
      })),
    };
  }

  private buildAcceptanceRecord(
    userId: string,
    documentType: LegalDocumentType,
    context?: LegalAcceptanceContext,
  ) {
    return {
      userId,
      documentType,
      version: LEGAL_DOCUMENT_VERSION,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    };
  }
}
