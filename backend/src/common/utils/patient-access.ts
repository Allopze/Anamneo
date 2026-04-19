import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getEffectiveMedicoId, RequestUser } from './medico-id';

export type PatientArchiveFilter = 'ACTIVE' | 'ARCHIVED' | 'ALL';

type AccessiblePatient = {
  id: string;
  createdById: string;
  archivedAt: Date | null;
  createdBy?: {
    medicoId: string | null;
  } | null;
};

type PatientScopeCandidate = Pick<AccessiblePatient, 'id' | 'createdById' | 'archivedAt' | 'createdBy'>;

type ScopedClinicalRecord = {
  encounterId?: string | null;
  createdById?: string | null;
  encounter?: {
    medicoId: string;
  } | null;
  createdBy?: {
    medicoId: string | null;
  } | null;
};

export function buildOwnedPatientsWhere(effectiveMedicoId: string): Prisma.PatientWhereInput {
  return {
    OR: [{ createdById: effectiveMedicoId }, { createdBy: { medicoId: effectiveMedicoId } }],
  };
}

export function isPatientOwnedByMedico(
  patient: Pick<AccessiblePatient, 'createdById' | 'createdBy'>,
  effectiveMedicoId: string,
): boolean {
  return patient.createdById === effectiveMedicoId || patient.createdBy?.medicoId === effectiveMedicoId;
}

export function buildPatientProblemScopeWhere(effectiveMedicoId: string): Prisma.PatientProblemWhereInput {
  return {
    OR: [
      { medicoId: effectiveMedicoId },
      // Fallback for legacy records without denormalized medicoId
      { medicoId: null, encounter: { medicoId: effectiveMedicoId } },
      {
        medicoId: null,
        encounterId: null,
        OR: [{ createdById: effectiveMedicoId }, { createdBy: { medicoId: effectiveMedicoId } }],
      },
    ],
  };
}

export function buildEncounterTaskScopeWhere(effectiveMedicoId: string): Prisma.EncounterTaskWhereInput {
  return {
    OR: [
      { medicoId: effectiveMedicoId },
      // Fallback for legacy records without denormalized medicoId
      { medicoId: null, encounter: { medicoId: effectiveMedicoId } },
      {
        medicoId: null,
        encounterId: null,
        OR: [{ createdById: effectiveMedicoId }, { createdBy: { medicoId: effectiveMedicoId } }],
      },
    ],
  };
}

export function isClinicalRecordInMedicoScope(
  record: Pick<ScopedClinicalRecord, 'encounterId' | 'createdById' | 'encounter' | 'createdBy'>,
  effectiveMedicoId: string,
): boolean {
  if (record.encounterId) {
    return record.encounter?.medicoId === effectiveMedicoId;
  }

  return record.createdById === effectiveMedicoId || record.createdBy?.medicoId === effectiveMedicoId;
}

function buildArchiveFilterWhere(archiveFilter: PatientArchiveFilter): Prisma.PatientWhereInput {
  if (archiveFilter === 'ALL') {
    return {};
  }

  if (archiveFilter === 'ARCHIVED') {
    return { archivedAt: { not: null } };
  }

  return { archivedAt: null };
}

export function buildAccessiblePatientsWhere(
  user: RequestUser,
  archiveFilter: PatientArchiveFilter = 'ACTIVE',
): Prisma.PatientWhereInput {
  const archiveWhere = buildArchiveFilterWhere(archiveFilter);

  if (user.isAdmin) {
    return archiveWhere;
  }

  const effectiveMedicoId = getEffectiveMedicoId(user);

  return {
    ...archiveWhere,
    OR: [buildOwnedPatientsWhere(effectiveMedicoId), { encounters: { some: { medicoId: effectiveMedicoId } } }],
  };
}

export async function assertPatientAccess(
  prisma: PrismaService,
  user: RequestUser,
  patientId: string,
): Promise<AccessiblePatient> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      createdById: true,
      archivedAt: true,
      createdBy: {
        select: { medicoId: true },
      },
    },
  });

  return assertLoadedPatientAccess(prisma, user, patientId, patient);
}

export async function assertLoadedPatientAccess<T extends PatientScopeCandidate | null>(
  prisma: PrismaService,
  user: RequestUser,
  patientId: string,
  patient: T,
): Promise<Exclude<T, null>> {
  const effectiveMedicoId = getEffectiveMedicoId(user);

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

  return patient as Exclude<T, null>;
}
