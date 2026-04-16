import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePatientProblemDto } from './dto/update-patient-problem.dto';
import { UpsertPatientProblemDto } from './dto/upsert-patient-problem.dto';
import {
  createPatientProblemMutation,
  createPatientTaskMutation,
  updatePatientProblemMutation,
  updatePatientTaskMutation,
} from './patients-clinical-mutations';

type AssertPatientAccessFn = (user: RequestUser, patientId: string) => Promise<unknown>;

interface ClinicalWriteSideDeps {
  prisma: PrismaService;
  auditService: AuditService;
  assertPatientAccess: AssertPatientAccessFn;
}

export interface CreatePatientTaskInput {
  title: string;
  details?: string;
  type?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  encounterId?: string;
}

export interface UpdatePatientTaskInput {
  title?: string;
  status?: string;
  details?: string;
  type?: string;
  priority?: string;
  dueDate?: string;
}

interface CreatePatientProblemCommandParams extends ClinicalWriteSideDeps {
  user: RequestUser;
  patientId: string;
  dto: UpsertPatientProblemDto;
}

interface UpdatePatientProblemCommandParams extends ClinicalWriteSideDeps {
  user: RequestUser;
  problemId: string;
  dto: UpdatePatientProblemDto;
}

interface CreatePatientTaskCommandParams extends ClinicalWriteSideDeps {
  user: RequestUser;
  patientId: string;
  dto: CreatePatientTaskInput;
}

interface UpdatePatientTaskCommandParams extends ClinicalWriteSideDeps {
  user: RequestUser;
  taskId: string;
  dto: UpdatePatientTaskInput;
}

export async function createPatientProblemCommand(params: CreatePatientProblemCommandParams) {
  const { prisma, auditService, assertPatientAccess, user, patientId, dto } = params;
  const effectiveMedicoId = getEffectiveMedicoId(user);

  return createPatientProblemMutation({
    prisma,
    auditService,
    user,
    patientId,
    dto,
    effectiveMedicoId,
    assertPatientAccess,
  });
}

export async function updatePatientProblemCommand(params: UpdatePatientProblemCommandParams) {
  const { prisma, auditService, assertPatientAccess, user, problemId, dto } = params;
  const effectiveMedicoId = getEffectiveMedicoId(user);

  return updatePatientProblemMutation({
    prisma,
    auditService,
    user,
    problemId,
    dto,
    effectiveMedicoId,
    assertPatientAccess,
  });
}

export async function createPatientTaskCommand(params: CreatePatientTaskCommandParams) {
  const { prisma, auditService, assertPatientAccess, user, patientId, dto } = params;
  const effectiveMedicoId = getEffectiveMedicoId(user);

  return createPatientTaskMutation({
    prisma,
    auditService,
    user,
    patientId,
    dto,
    effectiveMedicoId,
    assertPatientAccess,
  });
}

export async function updatePatientTaskCommand(params: UpdatePatientTaskCommandParams) {
  const { prisma, auditService, assertPatientAccess, user, taskId, dto } = params;
  const effectiveMedicoId = getEffectiveMedicoId(user);

  return updatePatientTaskMutation({
    prisma,
    auditService,
    user,
    taskId,
    dto,
    effectiveMedicoId,
    assertPatientAccess,
  });
}
