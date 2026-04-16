import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { isPatientOwnedByMedico } from '../common/utils/patient-access';

interface AssertPatientAccessScopeParams {
  prisma: PrismaService;
  user: RequestUser;
  patientId: string;
}

export async function assertPatientAccessScope(params: AssertPatientAccessScopeParams) {
  const { prisma, user, patientId } = params;
  const effectiveMedicoId = getEffectiveMedicoId(user);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      history: true,
      createdBy: {
        select: { medicoId: true },
      },
    },
  });

  if (!patient || patient.archivedAt) {
    throw new NotFoundException('Paciente no encontrado');
  }

  if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
    const hasEncounter = await prisma.encounter.findFirst({
      where: { patientId, medicoId: effectiveMedicoId },
      select: { id: true },
    });
    if (!hasEncounter) {
      throw new NotFoundException('Paciente no encontrado');
    }
  }

  return patient;
}
