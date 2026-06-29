import { PrismaService } from '../prisma/prisma.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { buildAccessiblePatientsWhere } from '../common/utils/patient-access';
import { buildPatientLevelOwnershipWhere } from './alerts.service.helpers';
import { resolvePatientIdentifiers } from '../patients/patients-identifiers';

export async function countUnacknowledgedAlerts(
  prisma: PrismaService,
  user: RequestUser,
): Promise<number> {
  const patientWhere = buildAccessiblePatientsWhere(user);
  const effectiveMedicoId = user.isAdmin ? null : getEffectiveMedicoId(user);

  return prisma.clinicalAlert.count({
    where: {
      acknowledgedAt: null,
      ...(effectiveMedicoId
        ? {
            OR: [
              {
                ...buildPatientLevelOwnershipWhere(effectiveMedicoId),
                patient: patientWhere,
              },
              {
                encounter: {
                  medicoId: effectiveMedicoId,
                  patient: { archivedAt: null },
                },
              },
            ],
          }
        : {
            patient: patientWhere,
          }),
    },
  });
}

export async function findRecentUnacknowledgedAlerts(
  prisma: PrismaService,
  user: RequestUser,
  take = 10,
) {
  const patientWhere = buildAccessiblePatientsWhere(user);
  const effectiveMedicoId = user.isAdmin ? null : getEffectiveMedicoId(user);

  const alerts = await prisma.clinicalAlert.findMany({
    where: {
      acknowledgedAt: null,
      ...(effectiveMedicoId
        ? {
            OR: [
              {
                ...buildPatientLevelOwnershipWhere(effectiveMedicoId),
                patient: patientWhere,
              },
              {
                encounter: {
                  medicoId: effectiveMedicoId,
                  patient: { archivedAt: null },
                },
              },
            ],
          }
        : {
            patient: patientWhere,
          }),
    },
    select: {
      id: true,
      type: true,
      severity: true,
      title: true,
      message: true,
      createdAt: true,
      patient: {
        select: { id: true, nombreEnc: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take,
  });

  return alerts.map((alert) => ({
    ...alert,
    patient: alert.patient
      ? { id: alert.patient.id, nombre: resolvePatientIdentifiers(alert.patient).nombre }
      : alert.patient,
  }));
}
