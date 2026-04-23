import { PrismaService } from '../prisma/prisma.service';
import { RequestUser, getEffectiveMedicoId } from '../common/utils/medico-id';
import { exportPatientsCsvReadModel } from './patients-read-side';
import { findPatientByIdReadModel } from './patients-read-side';
import { findPossiblePatientDuplicatesReadModel } from './patients-read-side';
import { findPatientsReadModel, FindPatientsFilters } from './patients-read-side';
import { getPatientAdminSummaryReadModel } from './patients-read-side';
import { getPatientOperationalHistoryReadModel } from './patients-operational-history-read-model';
import { getClinicalSummaryReadModel, getEncounterTimelineReadModel } from './patients-clinical-read-model';
import { findPatientTasksReadModel, PatientTaskInboxFilters } from './patients-task-read-model';

export async function findAllPatients(
  prisma: PrismaService,
  user: RequestUser,
  search?: string,
  page = 1,
  limit = 20,
  filters?: FindPatientsFilters,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  return findPatientsReadModel({
    prisma,
    user,
    effectiveMedicoId,
    search,
    page,
    limit,
    filters,
  });
}

export async function findPossiblePatientDuplicates(
  prisma: PrismaService,
  user: RequestUser,
  params: {
    rut?: string;
    nombre?: string;
    fechaNacimiento?: string;
    excludePatientId?: string;
  },
) {
  return findPossiblePatientDuplicatesReadModel({
    prisma,
    user,
    ...params,
  });
}

export async function exportPatientsCsv(
  prisma: PrismaService,
  auditService: any,
  user: RequestUser,
) {
  return exportPatientsCsvReadModel({
    prisma,
    auditService,
    user,
  });
}

export async function getPatientAdminSummary(
  prisma: PrismaService,
  user: RequestUser,
  id: string,
) {
  return getPatientAdminSummaryReadModel({
    prisma,
    id,
  });
}

export async function findPatientById(
  prisma: PrismaService,
  user: RequestUser,
  id: string,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  return findPatientByIdReadModel({
    prisma,
    user,
    id,
    effectiveMedicoId,
  });
}

export async function findEncounterTimeline(
  prisma: PrismaService,
  user: RequestUser,
  patientId: string,
  page = 1,
  limit = 10,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  return getEncounterTimelineReadModel({
    prisma,
    patientId,
    effectiveMedicoId,
    page,
    limit,
  });
}

export async function findOperationalHistory(
  prisma: PrismaService,
  user: RequestUser,
  patientId: string,
  limit = 20,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  return getPatientOperationalHistoryReadModel({
    prisma,
    patientId,
    effectiveMedicoId,
    limit,
  });
}

export async function getClinicalSummary(
  prisma: PrismaService,
  user: RequestUser,
  patientId: string,
  options?: { fullVitalHistory?: boolean },
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  const fullVitals = options?.fullVitalHistory === true;

  return getClinicalSummaryReadModel({
    prisma,
    user,
    patientId,
    effectiveMedicoId,
    fullVitals,
  });
}

export async function findTasks(
  prisma: PrismaService,
  user: RequestUser,
  filters?: PatientTaskInboxFilters,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  return findPatientTasksReadModel({
    prisma,
    user,
    effectiveMedicoId,
    filters,
  });
}
