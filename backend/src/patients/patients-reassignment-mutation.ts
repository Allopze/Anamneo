import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { isPatientOwnedByMedico } from '../common/utils/patient-access';
import { PrismaService } from '../prisma/prisma.service';
import { ReassignPatientDto } from './dto/reassign-patient.dto';

interface ReassignPatientParams {
  prisma: PrismaService;
  auditService: AuditService;
  patientId: string;
  dto: ReassignPatientDto;
  user: RequestUser;
}

async function assertTargetMedico(prisma: PrismaService, targetMedicoId: string) {
  const target = await prisma.user.findFirst({
    where: {
      id: targetMedicoId,
      role: 'MEDICO',
      active: true,
    },
    select: { id: true, nombre: true },
  });

  if (!target) {
    throw new BadRequestException('Medico destino no encontrado o inactivo');
  }

  return target;
}

export async function reassignPatientMutation(params: ReassignPatientParams) {
  const { prisma, auditService, patientId, dto, user } = params;
  const reason = dto.reason.trim();
  const includeOpenEncounters = dto.includeOpenEncounters === true;
  const target = await assertTargetMedico(prisma, dto.targetMedicoId);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      createdById: true,
      archivedAt: true,
      createdBy: { select: { medicoId: true } },
    },
  });

  if (!patient || patient.archivedAt) {
    throw new NotFoundException('Paciente no encontrado');
  }

  const effectiveMedicoId = getEffectiveMedicoId(user);
  if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
    throw new ForbiddenException('Solo el medico responsable o admin puede reasignar la ficha completa');
  }

  const previousMedicoId = patient.createdBy?.medicoId ?? patient.createdById;
  if (previousMedicoId === target.id) {
    throw new BadRequestException('El paciente ya esta asignado a ese medico');
  }

  return prisma.$transaction(async (tx) => {
    const updatedPatient = await tx.patient.update({
      where: { id: patientId },
      data: { createdById: target.id },
      select: {
        id: true,
        createdById: true,
        updatedAt: true,
      },
    });

    const movedProblems = await tx.patientProblem.updateMany({
      where: { patientId, medicoId: previousMedicoId },
      data: { medicoId: target.id },
    });

    const movedTasks = await tx.encounterTask.updateMany({
      where: { patientId, medicoId: previousMedicoId },
      data: { medicoId: target.id },
    });

    const movedOpenEncounters = includeOpenEncounters
      ? await tx.encounter.updateMany({
          where: {
            patientId,
            medicoId: previousMedicoId,
            status: 'EN_PROGRESO',
          },
          data: { medicoId: target.id },
        })
      : { count: 0 };

    await auditService.log(
      {
        entityType: 'Patient',
        entityId: patientId,
        userId: user.id,
        action: 'UPDATE',
        reason: 'PATIENT_REASSIGNED',
        diff: {
          scope: 'PATIENT_REASSIGNMENT',
          fromMedicoId: previousMedicoId,
          toMedicoId: target.id,
          reason,
          includeOpenEncounters,
          movedOpenEncounterCount: movedOpenEncounters.count,
          movedProblemCount: movedProblems.count,
          movedTaskCount: movedTasks.count,
          notification: {
            internalOnly: true,
            actorId: user.id,
            targetMedicoId: target.id,
          },
        },
      },
      tx,
    );

    return {
      patientId,
      assignedMedicoId: updatedPatient.createdById,
      assignedMedicoName: target.nombre,
      movedOpenEncounterCount: movedOpenEncounters.count,
      movedProblemCount: movedProblems.count,
      movedTaskCount: movedTasks.count,
    };
  });
}
