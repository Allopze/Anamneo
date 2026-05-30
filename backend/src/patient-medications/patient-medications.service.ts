import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertPatientAccess } from '../common/utils/patient-access';
import { RequestUser } from '../common/utils/medico-id';
import {
  CreatePatientMedicationDto,
  UpdatePatientMedicationDto,
} from './dto/patient-medication.dto';

@Injectable()
export class PatientMedicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findByPatient(patientId: string, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, patientId);
    return this.prisma.patientMedication.findMany({
      where: { patientId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        drug: true,
        dose: true,
        route: true,
        frequency: true,
        status: true,
        startDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, nombre: true } },
      },
    });
  }

  async create(dto: CreatePatientMedicationDto, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, dto.patientId);
    const medication = await this.prisma.patientMedication.create({
      data: {
        patientId: dto.patientId,
        drug: dto.drug.trim(),
        dose: dto.dose?.trim() ?? null,
        route: dto.route?.trim() ?? null,
        frequency: dto.frequency?.trim() ?? null,
        status: dto.status ?? 'ACTIVO',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        notes: dto.notes?.trim() ?? null,
        createdById: user.id,
      },
    });
    await this.audit.log({
      entityType: 'PatientMedication',
      entityId: medication.id,
      userId: user.id,
      action: 'CREATE',
      reason: 'MEDICATION_CREATED',
      diff: { patientId: dto.patientId, drug: medication.drug, status: medication.status },
    });
    return medication;
  }

  async update(id: string, dto: UpdatePatientMedicationDto, user: RequestUser) {
    const existing = await this.prisma.patientMedication.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Medicamento no encontrado');
    await assertPatientAccess(this.prisma, user, existing.patientId);

    const updated = await this.prisma.patientMedication.update({
      where: { id },
      data: {
        drug: dto.drug?.trim() ?? existing.drug,
        dose: dto.dose !== undefined ? (dto.dose?.trim() || null) : existing.dose,
        route: dto.route !== undefined ? (dto.route?.trim() || null) : existing.route,
        frequency:
          dto.frequency !== undefined ? (dto.frequency?.trim() || null) : existing.frequency,
        status: dto.status ?? existing.status,
        startDate:
          dto.startDate !== undefined
            ? dto.startDate
              ? new Date(dto.startDate)
              : null
            : existing.startDate,
        notes: dto.notes !== undefined ? (dto.notes?.trim() || null) : existing.notes,
      },
    });
    await this.audit.log({
      entityType: 'PatientMedication',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      reason: 'MEDICATION_UPDATED',
      diff: dto,
    });
    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const existing = await this.prisma.patientMedication.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Medicamento no encontrado');
    await assertPatientAccess(this.prisma, user, existing.patientId);

    await this.prisma.patientMedication.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      entityType: 'PatientMedication',
      entityId: id,
      userId: user.id,
      action: 'DELETE',
      reason: 'MEDICATION_REMOVED',
      diff: { drug: existing.drug },
    });
    return { ok: true };
  }
}
