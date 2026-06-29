import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { assertPatientAccess } from '../common/utils/patient-access';
import { CreateAppointmentDto, UpdateAppointmentDto, CancelAppointmentDto } from './dto/appointment.dto';
import { PATIENT_ENCRYPTED_IDENTIFIER_SELECT, withPatientIdentifiers } from '../patients/patients-identifiers';

function formatAppointment<T extends { patient?: any | null }>(appointment: T) {
  return {
    ...appointment,
    patient: appointment.patient ? withPatientIdentifiers(appointment.patient) : null,
  };
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findByRange(medicoId: string, startDate: string, endDate: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Agenda no encontrada');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Fechas inválidas');
    }

    const APPOINTMENT_RANGE_LIMIT = 500;
    const appointments = await this.prisma.appointment.findMany({
      where: {
        medicoId,
        startAt: { gte: start },
        endAt: { lte: end },
        cancelledAt: null,
      },
      orderBy: { startAt: 'asc' },
      take: APPOINTMENT_RANGE_LIMIT,
      select: {
        id: true,
        medicoId: true,
        patientId: true,
        startAt: true,
        endAt: true,
        status: true,
        title: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        patient: {
          select: { id: true, ...PATIENT_ENCRYPTED_IDENTIFIER_SELECT },
        },
        medico: { select: { id: true, nombre: true } },
      },
    });
    return {
      appointments: appointments.map(formatAppointment),
      truncated: appointments.length === APPOINTMENT_RANGE_LIMIT,
    };
  }

  async create(dto: CreateAppointmentDto, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && dto.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Agenda no encontrada');
    }
    if (dto.patientId) {
      await assertPatientAccess(this.prisma, user, dto.patientId);
    }

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (end <= start) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        medicoId: dto.medicoId,
        patientId: dto.patientId ?? null,
        startAt: start,
        endAt: end,
        title: dto.title?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        createdById: user.id,
      },
      select: {
        id: true,
        medicoId: true,
        patientId: true,
        startAt: true,
        endAt: true,
        status: true,
        title: true,
        notes: true,
        createdAt: true,
        patient: { select: { id: true, ...PATIENT_ENCRYPTED_IDENTIFIER_SELECT } },
      },
    });

    await this.audit.log({
      entityType: 'Appointment',
      entityId: appointment.id,
      userId: user.id,
      action: 'CREATE',
      reason: 'APPOINTMENT_CREATED',
    });

    return formatAppointment(appointment);
  }

  async update(id: string, dto: UpdateAppointmentDto, user: RequestUser) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing || existing.cancelledAt) {
      throw new NotFoundException('Cita no encontrada');
    }
    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && existing.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Cita no encontrada');
    }
    if (dto.patientId) {
      await assertPatientAccess(this.prisma, user, dto.patientId);
    }

    const data: Record<string, unknown> = {};
    if (dto.patientId !== undefined) data.patientId = dto.patientId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.title !== undefined) data.title = dto.title?.trim() ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;
    if (dto.startAt !== undefined) data.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) data.endAt = new Date(dto.endAt);

    if (data.startAt && data.endAt && (data.endAt as Date) <= (data.startAt as Date)) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data,
      select: {
        id: true,
        medicoId: true,
        patientId: true,
        startAt: true,
        endAt: true,
        status: true,
        title: true,
        notes: true,
        updatedAt: true,
        patient: { select: { id: true, ...PATIENT_ENCRYPTED_IDENTIFIER_SELECT } },
      },
    });

    await this.audit.log({
      entityType: 'Appointment',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      reason: 'APPOINTMENT_UPDATED',
    });

    return formatAppointment(updated);
  }

  async cancel(id: string, dto: CancelAppointmentDto, user: RequestUser) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing || existing.cancelledAt) {
      throw new NotFoundException('Cita no encontrada');
    }
    const effectiveMedicoId = getEffectiveMedicoId(user);
    if (!user.isAdmin && existing.medicoId !== effectiveMedicoId) {
      throw new NotFoundException('Cita no encontrada');
    }

    await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELADA',
        cancelledAt: new Date(),
        cancelReason: dto.reason?.trim() ?? null,
      },
    });

    await this.audit.log({
      entityType: 'Appointment',
      entityId: id,
      userId: user.id,
      action: 'DELETE',
      reason: 'APPOINTMENT_CANCELLED',
    });
  }
}
