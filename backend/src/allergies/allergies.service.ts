import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertPatientAccess } from '../common/utils/patient-access';
import { RequestUser } from '../common/utils/medico-id';
import { CreateAllergyDto, UpdateAllergyDto } from './dto/allergy.dto';

@Injectable()
export class AllergiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findByPatient(patientId: string, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, patientId);
    return this.prisma.patientAllergy.findMany({
      where: { patientId, deletedAt: null },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        allergen: true,
        severity: true,
        reactionType: true,
        onsetDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, nombre: true } },
      },
    });
  }

  async create(dto: CreateAllergyDto, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, dto.patientId);
    const allergy = await this.prisma.patientAllergy.create({
      data: {
        patientId: dto.patientId,
        allergen: dto.allergen.trim(),
        severity: dto.severity ?? 'MODERADA',
        reactionType: dto.reactionType?.trim() ?? null,
        onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : null,
        notes: dto.notes?.trim() ?? null,
        createdById: user.id,
      },
    });
    await this.audit.log({
      entityType: 'PatientAllergy',
      entityId: allergy.id,
      userId: user.id,
      action: 'CREATE',
      reason: 'ALLERGY_CREATED',
      diff: { patientId: dto.patientId, allergen: allergy.allergen, severity: allergy.severity },
    });
    return allergy;
  }

  async update(id: string, dto: UpdateAllergyDto, user: RequestUser) {
    const existing = await this.prisma.patientAllergy.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Alergia no encontrada');
    await assertPatientAccess(this.prisma, user, existing.patientId);

    const updated = await this.prisma.patientAllergy.update({
      where: { id },
      data: {
        allergen: dto.allergen?.trim() ?? existing.allergen,
        severity: dto.severity ?? existing.severity,
        reactionType: dto.reactionType !== undefined ? (dto.reactionType?.trim() || null) : existing.reactionType,
        onsetDate: dto.onsetDate !== undefined ? (dto.onsetDate ? new Date(dto.onsetDate) : null) : existing.onsetDate,
        notes: dto.notes !== undefined ? (dto.notes?.trim() || null) : existing.notes,
      },
    });
    await this.audit.log({
      entityType: 'PatientAllergy',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      reason: 'ALLERGY_UPDATED',
      diff: dto,
    });
    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const existing = await this.prisma.patientAllergy.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Alergia no encontrada');
    await assertPatientAccess(this.prisma, user, existing.patientId);

    await this.prisma.patientAllergy.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      entityType: 'PatientAllergy',
      entityId: id,
      userId: user.id,
      action: 'DELETE',
      reason: 'ALLERGY_REMOVED',
      diff: { allergen: existing.allergen },
    });
    return { ok: true };
  }
}
