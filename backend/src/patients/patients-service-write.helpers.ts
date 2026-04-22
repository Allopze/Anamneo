import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, type RequestUser } from '../common/utils/medico-id';
import { decoratePatient } from './patients-format';
import {
  updatePatientAdminDemographicsMutation,
  updatePatientDemographicsMutation,
} from './patients-demographics-mutations';
import {
  archivePatientMutation,
  restorePatientMutation,
  updatePatientHistoryMutation,
  verifyPatientDemographicsMutation,
} from './patients-lifecycle-mutations';
import { mergePatientIntoTarget } from './patients-merge-mutation';
import {
  createPatientMutation,
  createQuickPatientMutation,
} from './patients-intake-mutations';
import {
  createPatientProblemCommand,
  createPatientTaskCommand,
  CreatePatientTaskInput,
  updatePatientProblemCommand,
  updatePatientTaskCommand,
  UpdatePatientTaskInput,
} from './patients-clinical-write-side';
import { MergePatientDto } from './dto/merge-patient.dto';

export async function createPatient(
  prisma: PrismaService,
  auditService: AuditService,
  createPatientDto: any,
  userId: string,
) {
  return createPatientMutation({
    prisma,
    auditService,
    createPatientDto,
    userId,
  });
}

export async function createQuickPatient(
  prisma: PrismaService,
  auditService: AuditService,
  createPatientDto: any,
  user: RequestUser,
) {
  return createQuickPatientMutation({
    prisma,
    auditService,
    createPatientDto,
    user,
  });
}

export async function updatePatient(
  prisma: PrismaService,
  auditService: AuditService,
  id: string,
  updatePatientDto: any,
  user: RequestUser,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);

  const patient = await updatePatientDemographicsMutation({
    prisma,
    auditService,
    id,
    updatePatientDto,
    user,
    effectiveMedicoId,
  });

  return decoratePatient(patient);
}

export async function updateAdminFields(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  patientId: string,
  dto: any,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  const patient = await updatePatientAdminDemographicsMutation({
    prisma,
    auditService,
    patientId,
    dto,
    user,
    assertPatientAccess,
  });

  return decoratePatient(patient);
}

export async function verifyDemographics(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  patientId: string,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  const updatedPatient = await verifyPatientDemographicsMutation({
    prisma,
    auditService,
    user,
    patientId,
    assertPatientAccess,
  });

  return decoratePatient(updatedPatient);
}

export async function mergeIntoTarget(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  targetPatientId: string,
  dto: MergePatientDto,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  const result = await mergePatientIntoTarget({
    prisma,
    auditService,
    user,
    targetPatientId,
    sourcePatientId: dto.sourcePatientId,
    assertPatientAccess,
  });

  return {
    patient: decoratePatient(result.patient),
    counts: result.counts,
  };
}

export async function updateHistory(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  patientId: string,
  dto: any,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  return updatePatientHistoryMutation({
    prisma,
    auditService,
    user,
    patientId,
    dto,
    assertPatientAccess,
  });
}

export async function removePatient(
  prisma: PrismaService,
  auditService: AuditService,
  id: string,
  user: RequestUser,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  return archivePatientMutation({
    prisma,
    auditService,
    id,
    user,
    effectiveMedicoId,
  });
}

export async function restorePatient(
  prisma: PrismaService,
  auditService: AuditService,
  id: string,
  user: RequestUser,
) {
  const effectiveMedicoId = getEffectiveMedicoId(user);
  return restorePatientMutation({
    prisma,
    auditService,
    id,
    user,
    effectiveMedicoId,
  });
}

export async function createProblem(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  patientId: string,
  dto: any,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  return createPatientProblemCommand({
    prisma,
    auditService,
    assertPatientAccess,
    user,
    patientId,
    dto,
  });
}

export async function updateProblem(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  problemId: string,
  dto: any,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  return updatePatientProblemCommand({
    prisma,
    auditService,
    assertPatientAccess,
    user,
    problemId,
    dto,
  });
}

export async function createTask(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  patientId: string,
  dto: CreatePatientTaskInput,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  return createPatientTaskCommand({
    prisma,
    auditService,
    assertPatientAccess,
    user,
    patientId,
    dto,
  });
}

export async function updateTaskStatus(
  prisma: PrismaService,
  auditService: AuditService,
  user: RequestUser,
  taskId: string,
  dto: UpdatePatientTaskInput,
  assertPatientAccess: (user: RequestUser, patientId: string) => Promise<any>,
) {
  return updatePatientTaskCommand({
    prisma,
    auditService,
    assertPatientAccess,
    user,
    taskId,
    dto,
  });
}
