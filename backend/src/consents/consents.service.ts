import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConsentDto, RevokeConsentDto } from './dto/consent.dto';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { assertPatientAccess } from '../common/utils/patient-access';

type ConsentRecord = {
  id: string;
  patientId: string;
  encounterId: string | null;
  type: string;
  description: string;
  grantedAt: Date;
  grantedById: string;
  revokedAt: Date | null;
  revokedById: string | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private buildPatientLevelOwnershipWhere(effectiveMedicoId: string) {
    return {
      encounterId: null,
      OR: [
        { grantedById: effectiveMedicoId },
        { grantedBy: { medicoId: effectiveMedicoId } },
      ],
    };
  }

  private isPatientLevelConsentInMedicoScope(
    consent: { grantedById: string; grantedBy?: { medicoId: string | null } | null },
    effectiveMedicoId: string,
  ) {
    return consent.grantedById === effectiveMedicoId || consent.grantedBy?.medicoId === effectiveMedicoId;
  }

  private async resolveUserNames(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, string>();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre: true },
    });

    return new Map(users.map((user) => [user.id, user.nombre]));
  }

  private formatConsent(consent: ConsentRecord, userNames?: Map<string, string>) {
    const grantedByName = userNames?.get(consent.grantedById);

    return {
      id: consent.id,
      patientId: consent.patientId,
      encounterId: consent.encounterId,
      type: consent.type,
      description: consent.description,
      status: consent.revokedAt ? 'REVOCADO' : 'ACTIVO',
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt,
      revokeReason: consent.revokedReason,
      createdAt: consent.createdAt,
      updatedAt: consent.updatedAt,
      grantedBy: grantedByName ? { nombre: grantedByName } : null,
    };
  }

  private async assertEncounterMatchesPatient(encounterId: string, patientId: string, user: RequestUser) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { patientId: true, medicoId: true },
    });

    if (!encounter) {
      throw new BadRequestException('La atención indicada no existe');
    }

    if (encounter.patientId !== patientId) {
      throw new BadRequestException('La atención indicada no corresponde al paciente');
    }

    if (!user.isAdmin && encounter.medicoId !== getEffectiveMedicoId(user)) {
      throw new BadRequestException('La atención indicada no existe para este paciente');
    }
  }

  async create(dto: CreateConsentDto, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, dto.patientId);

    if (dto.encounterId) {
      await this.assertEncounterMatchesPatient(dto.encounterId, dto.patientId, user);
    }

    const consent = await this.prisma.$transaction(async (tx) => {
      const createdConsent = await tx.informedConsent.create({
        data: {
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? null,
          type: dto.type,
          description: dto.description,
          grantedById: user.id,
        },
      });

      await this.audit.log(
        {
          entityType: 'InformedConsent',
          entityId: createdConsent.id,
          userId: user.id,
          action: 'CREATE',
          reason: 'CONSENT_GRANTED',
          diff: { type: dto.type, patientId: dto.patientId, encounterId: dto.encounterId ?? null },
        },
        tx,
      );

      return createdConsent;
    });

    return this.formatConsent(consent);
  }

  async findByPatient(
    patientId: string,
    user: RequestUser,
    options: { revokedLimit?: number; withMeta: true },
  ): Promise<{ data: any[]; meta: { revokedHasMore: boolean } }>;
  async findByPatient(
    patientId: string,
    user: RequestUser,
    options?: { revokedLimit?: number; withMeta?: false },
  ): Promise<any[]>;
  async findByPatient(
    patientId: string,
    user: RequestUser,
    options: { revokedLimit?: number; withMeta?: boolean } = {},
  ): Promise<any[] | { data: any[]; meta: { revokedHasMore: boolean } }> {
    await assertPatientAccess(this.prisma, user, patientId);

    const effectiveMedicoId = user.isAdmin ? null : getEffectiveMedicoId(user);
    const scopeWhere = {
      patientId,
      ...(effectiveMedicoId
        ? {
            OR: [
              this.buildPatientLevelOwnershipWhere(effectiveMedicoId),
              { encounter: { medicoId: effectiveMedicoId } },
            ],
          }
        : {}),
    };
    const activeConsents = await this.prisma.informedConsent.findMany({
      where: {
        ...scopeWhere,
        revokedAt: null,
      },
      orderBy: { grantedAt: 'desc' },
    });
    const revokedLimit = Number.isFinite(options.revokedLimit)
      ? Math.max(0, Math.min(options.revokedLimit ?? 0, 100))
      : undefined;
    const revokedTake = options.withMeta && revokedLimit !== undefined ? revokedLimit + 1 : revokedLimit;
    const rawRevokedConsents = await this.prisma.informedConsent.findMany({
      where: {
        ...scopeWhere,
        revokedAt: { not: null },
      },
      orderBy: { revokedAt: 'desc' },
      ...(revokedTake === undefined ? {} : { take: revokedTake }),
    });
    const revokedHasMore = revokedLimit !== undefined && rawRevokedConsents.length > revokedLimit;
    const revokedConsents = revokedHasMore ? rawRevokedConsents.slice(0, revokedLimit) : rawRevokedConsents;
    const consents = [...activeConsents, ...revokedConsents];

    const userNames = await this.resolveUserNames(Array.from(new Set(consents.map((consent) => consent.grantedById))));

    const data = consents.map((consent) => this.formatConsent(consent, userNames));
    if (options.withMeta) {
      return {
        data,
        meta: {
          revokedHasMore,
        },
      };
    }
    return data;
  }

  async revoke(id: string, dto: RevokeConsentDto, user: RequestUser) {
    const effectiveMedicoId = user.isAdmin ? null : getEffectiveMedicoId(user);
    const consent = await this.prisma.informedConsent.findUnique({
      where: { id },
      include: {
        encounter: {
          select: { medicoId: true },
        },
        grantedBy: {
          select: { medicoId: true },
        },
      },
    });
    if (!consent) throw new NotFoundException('Consentimiento no encontrado');
    if (consent.revokedAt) throw new BadRequestException('El consentimiento ya fue revocado');

    await assertPatientAccess(this.prisma, user, consent.patientId);

    if (!user.isAdmin && effectiveMedicoId) {
      if (consent.encounterId) {
        if (consent.encounter?.medicoId !== effectiveMedicoId) {
          throw new NotFoundException('Consentimiento no encontrado');
        }
      } else if (!this.isPatientLevelConsentInMedicoScope(consent, effectiveMedicoId)) {
        throw new NotFoundException('Consentimiento no encontrado');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const revokedConsent = await tx.informedConsent.update({
        where: { id },
        data: {
          revokedAt: new Date(),
          revokedById: user.id,
          revokedReason: dto.reason,
        },
      });

      await this.audit.log(
        {
          entityType: 'InformedConsent',
          entityId: id,
          userId: user.id,
          action: 'UPDATE',
          reason: 'CONSENT_REVOKED',
          diff: {
            revokedAt: revokedConsent.revokedAt,
            revokedReason: dto.reason,
          },
        },
        tx,
      );

      return revokedConsent;
    });

    return this.formatConsent(updated);
  }
}
