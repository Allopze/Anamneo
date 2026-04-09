import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getEffectiveMedicoId, RequestUser } from './medico-id';

type AccessiblePatient = {
  id: string;
  createdById: string;
  archivedAt: Date | null;
};

export function buildAccessiblePatientsWhere(user: RequestUser): Prisma.PatientWhereInput {
  if (user.isAdmin) {
    return { archivedAt: null };
  }

  const effectiveMedicoId = getEffectiveMedicoId(user);

  return {
    archivedAt: null,
    OR: [
      { createdById: effectiveMedicoId },
      { encounters: { some: { medicoId: effectiveMedicoId } } },
    ],
  };
}

export async function assertPatientAccess(
  prisma: PrismaService,
  user: RequestUser,
  patientId: string,
): Promise<AccessiblePatient> {
  const effectiveMedicoId = getEffectiveMedicoId(user);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      createdById: true,
      archivedAt: true,
    },
  });

  if (!patient || patient.archivedAt) {
    throw new NotFoundException('Paciente no encontrado');
  }

  if (!user.isAdmin && patient.createdById !== effectiveMedicoId) {
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