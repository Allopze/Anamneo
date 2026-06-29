import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/utils/medico-id';
import { assertLoadedPatientAccess } from '../common/utils/patient-access';

interface AssertPatientAccessScopeParams {
  prisma: PrismaService;
  user: RequestUser;
  patientId: string;
}

export async function assertPatientAccessScope(params: AssertPatientAccessScopeParams) {
  const { prisma, user, patientId } = params;

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

  return assertLoadedPatientAccess(prisma, user, patientId, patient);
}
