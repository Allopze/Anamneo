import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/utils/medico-id';

/**
 * Ley 21.719 Art 8 ter (bloqueo temporal del tratamiento).
 *
 * El titular puede solicitar la suspension temporal del tratamiento mientras
 * se resuelve una solicitud de rectificacion, supresion u oposicion. El
 * plazo del responsable para resolver el bloqueo es de 2 dias habiles.
 *
 * Este servicio expone el bloqueo y desbloqueo de pacientes como una
 * accion regulatoria de primera clase (con razon obligatoria), separada de
 * un PATCH generico del paciente. El `PatientNotBlockedGuard` consume el
 * flag `Patient.blockedAt` automaticamente en mutaciones clinicas.
 */
@Injectable()
export class PatientsBlockingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async block(patientId: string, reason: string, user: RequestUser) {
    if (reason.trim().length < 10) {
      throw new BadRequestException('La razon de bloqueo debe tener al menos 10 caracteres');
    }
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, blockedAt: true },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (patient.blockedAt) {
      throw new BadRequestException('El paciente ya esta bloqueado');
    }
    const now = new Date();
    const updated = await this.prisma.patient.update({
      where: { id: patientId },
      data: {
        blockedAt: now,
        blockedReason: reason.slice(0, 1000),
        blockedById: user.id,
      },
      select: { id: true, blockedAt: true, blockedReason: true, blockedById: true },
    });
    await this.audit.log({
      entityType: 'Patient',
      entityId: patientId,
      userId: user.id,
      action: 'UPDATE',
      reason: 'PATIENT_BLOCKED',
      diff: {
        blockedAt: now.toISOString(),
        blockedReason: reason.slice(0, 200),
      },
    });
    return updated;
  }

  async unblock(patientId: string, reason: string, user: RequestUser) {
    if (reason.trim().length < 10) {
      throw new BadRequestException('La razon del desbloqueo debe tener al menos 10 caracteres');
    }
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, blockedAt: true, blockedReason: true },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (!patient.blockedAt) {
      throw new BadRequestException('El paciente no esta bloqueado');
    }
    const updated = await this.prisma.patient.update({
      where: { id: patientId },
      data: {
        blockedAt: null,
        blockedReason: null,
        blockedById: null,
      },
      select: { id: true, blockedAt: true },
    });
    await this.audit.log({
      entityType: 'Patient',
      entityId: patientId,
      userId: user.id,
      action: 'UPDATE',
      reason: 'PATIENT_UNBLOCKED',
      diff: {
        blockedAt: null,
        previousBlockedReason: patient.blockedReason?.slice(0, 200) ?? null,
        unblockReason: reason.slice(0, 200),
      },
    });
    return updated;
  }
}
