import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConsentDto, RevokeConsentDto } from './dto/consent.dto';
import { RequestUser } from '../common/utils/medico-id';
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

  private async assertEncounterMatchesPatient(encounterId: string, patientId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { patientId: true },
    });

    if (!encounter) {
      throw new BadRequestException('La atención indicada no existe');
    }

    if (encounter.patientId !== patientId) {
      throw new BadRequestException('La atención indicada no corresponde al paciente');
    }
  }

  async create(dto: CreateConsentDto, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, dto.patientId);

    if (dto.encounterId) {
      await this.assertEncounterMatchesPatient(dto.encounterId, dto.patientId);
    }

    const consent = await this.prisma.informedConsent.create({
      data: {
        patientId: dto.patientId,
        encounterId: dto.encounterId ?? null,
        type: dto.type,
        description: dto.description,
        grantedById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'InformedConsent',
      entityId: consent.id,
      userId: user.id,
      action: 'CREATE',
      reason: 'CONSENT_GRANTED',
      diff: { type: dto.type, patientId: dto.patientId, encounterId: dto.encounterId ?? null },
    });

    return this.formatConsent(consent);
  }

  async findByPatient(patientId: string, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, patientId);

    const consents = await this.prisma.informedConsent.findMany({
      where: { patientId },
      orderBy: { grantedAt: 'desc' },
    });

    const userNames = await this.resolveUserNames(Array.from(new Set(consents.map((consent) => consent.grantedById))));

    return consents.map((consent) => this.formatConsent(consent, userNames));
  }

  async revoke(id: string, dto: RevokeConsentDto, user: RequestUser) {
    const consent = await this.prisma.informedConsent.findUnique({ where: { id } });
    if (!consent) throw new NotFoundException('Consentimiento no encontrado');
    if (consent.revokedAt) throw new BadRequestException('El consentimiento ya fue revocado');

    await assertPatientAccess(this.prisma, user, consent.patientId);

    const updated = await this.prisma.informedConsent.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        revokedById: user.id,
        revokedReason: dto.reason,
      },
    });

    await this.audit.log({
      entityType: 'InformedConsent',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      reason: 'CONSENT_REVOKED',
      diff: {
        revokedAt: updated.revokedAt,
        revokedReason: dto.reason,
      },
    });

    return this.formatConsent(updated);
  }
}
