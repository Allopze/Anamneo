import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import { canAccessEncounter } from './encounter-policy';
import { ReassignEncounterDto } from './dto/reassign-encounter.dto';

interface ReassignEncounterParams {
  prisma: PrismaService;
  auditService: AuditService;
  encounterId: string;
  dto: ReassignEncounterDto;
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

export async function reassignEncounterMutation(params: ReassignEncounterParams) {
  const { prisma, auditService, encounterId, dto, user } = params;
  const reason = dto.reason.trim();
  const target = await assertTargetMedico(prisma, dto.targetMedicoId);
  const effectiveMedicoId = getEffectiveMedicoId(user);

  const encounter = await prisma.encounter.findFirst({
    where: user.isAdmin ? { id: encounterId } : { id: encounterId, medicoId: effectiveMedicoId },
    select: {
      id: true,
      patientId: true,
      medicoId: true,
      status: true,
    },
  });

  if (!encounter || !canAccessEncounter(user, encounter.medicoId)) {
    throw new NotFoundException('Atencion no encontrada');
  }

  if (encounter.medicoId === target.id) {
    throw new BadRequestException('La atencion ya esta asignada a ese medico');
  }

  const overrideClosed = user.isAdmin && dto.allowClosedOverride === true;
  if (encounter.status !== 'EN_PROGRESO' && !overrideClosed) {
    throw new BadRequestException('Solo se pueden reasignar atenciones en progreso');
  }

  if (!user.isAdmin && user.role !== 'MEDICO') {
    throw new ForbiddenException('Solo el medico responsable o admin puede reasignar una atencion');
  }

  return prisma.$transaction(async (tx) => {
    const updatedEncounter = await tx.encounter.update({
      where: { id: encounterId },
      data: { medicoId: target.id },
      select: {
        id: true,
        patientId: true,
        medicoId: true,
        status: true,
      },
    });

    const movedProblems = await tx.patientProblem.updateMany({
      where: { encounterId, medicoId: encounter.medicoId },
      data: { medicoId: target.id },
    });

    const movedTasks = await tx.encounterTask.updateMany({
      where: { encounterId, medicoId: encounter.medicoId },
      data: { medicoId: target.id },
    });

    await auditService.log(
      {
        entityType: 'Encounter',
        entityId: encounterId,
        userId: user.id,
        action: 'UPDATE',
        reason: 'ENCOUNTER_REASSIGNED',
        diff: {
          scope: 'ENCOUNTER_REASSIGNMENT',
          patientId: encounter.patientId,
          fromMedicoId: encounter.medicoId,
          toMedicoId: target.id,
          reason,
          allowClosedOverride: overrideClosed,
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
      encounterId,
      patientId: updatedEncounter.patientId,
      assignedMedicoId: updatedEncounter.medicoId,
      assignedMedicoName: target.nombre,
      status: updatedEncounter.status,
      movedProblemCount: movedProblems.count,
      movedTaskCount: movedTasks.count,
    };
  });
}
